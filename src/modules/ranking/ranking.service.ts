import { Injectable, NotFoundException } from '@nestjs/common';
import { RankingScraperService } from './ranking.scraper.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Ranking, RankingDocument } from './ranking.entity';
import { CreateRankingDto } from './dto/create-ranking.dto';
import { UpdateRankingDto } from './dto/update-ranking.dto';
import { ResponseService } from '../../common/services/response.service';



@Injectable()
export class RankingService {
  constructor(
    @InjectModel(Ranking.name) private rankingModel: Model<RankingDocument>,
    private readonly responseService: ResponseService,
    private readonly rankingScraper: RankingScraperService,
  ) { }

  async create(dto: CreateRankingDto) {
    const created = new this.rankingModel({
      ...dto,
      type: dto.playerId ? 'player' : 'team',
    });
    const saved = await created.save();
    return saved;
  }

  async findAll(query: any = {}) {
    // Only pick valid filter keys to avoid Mongo injection or invalid queries
    const filter: any = {};
    if (query.type) filter.type = query.type;
    if (query.gender) filter.gender = query.gender;
    if (query.format) filter.format = query.format;
    if (query.role) filter.role = query.role;
    
    // Support searching by name or teamName
    if (query.search) {
      const searchRegex = new RegExp(query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { teamName: searchRegex }
      ];
    } else if (query.teamName) {
      filter.teamName = query.teamName;
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    // Sort by rating descending, then points descending
    const [result, total] = await Promise.all([
      this.rankingModel.find(filter).sort({ rating: -1, points: -1 }).skip(skip).limit(limit).exec(),
      this.rankingModel.countDocuments(filter).exec()
    ]);

    const rankedResult = result.map((item, index) => {
      const obj = item.toObject();
      obj.rank = skip + index + 1; // Dynamically assign rank based on sorted points/rating
      return obj;
    });

    return {
      result: rankedResult,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const ranking = await this.rankingModel.findById(id).exec();
    if (!ranking) throw new NotFoundException('Ranking not found');
    return ranking;
  }

  async update(id: string, dto: UpdateRankingDto) {
    const updated = await this.rankingModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException('Ranking not found');
    return updated;
  }

  async remove(id: string) {
    const result = await this.rankingModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Ranking not found');
    return null;
  }

  // Refresh from Cricbuzz scraper
  async refreshFromScraper(scraperData: any[]) {
    const ops = await Promise.all(scraperData.map(async (item) => {
      // Find filter based on type
      const filter: any = { type: item.type, gender: item.gender, format: item.format };
      
      if (item.type === 'player') {
        filter.name = item.name;
        filter.role = item.role;
      } else {
        filter.teamName = item.teamName;
      }

      // Check existing to calculate changes
      const existing = await this.rankingModel.findOne(filter).exec();
      
      const updateData = { ...item };
      
      if (existing) {
        updateData.previousRank = existing.rank;
        if (item.type === 'player') {
          updateData.pointsChange = item.rating - (existing.rating || 0);
          updateData.careerBestRating = Math.max(existing.careerBestRating || 0, item.rating);
          // For rank, lower is better
          updateData.careerBestRank = existing.careerBestRank ? Math.min(existing.careerBestRank, item.rank) : item.rank;
        } else {
          updateData.pointsChange = existing.rank - item.rank; // For teams, user reference code tracks rank change as points_change
        }
      } else {
        updateData.previousRank = item.rank;
        updateData.pointsChange = 0;
        if (item.type === 'player') {
          updateData.careerBestRating = item.rating;
          updateData.careerBestRank = item.rank;
        }
      }
      
      updateData.lastUpdated = new Date();

      return this.rankingModel.updateOne(filter, { $set: updateData }, { upsert: true }).exec();
    }));
    
    return 'Rankings refreshed from scraper';
  }

  // New method: preview scraper data without persisting
  async previewScraperData(params: any): Promise<any[]> {
    const raw = await this.rankingScraper.fetchWithParams(params);
    // Attach source flag for UI clarity
    return raw.map(item => ({ ...item, source: 'scraper' as const }));
  }
}
