import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument } from '../../entities/user.entity';

export const ADMIN_ROLES = ['admin', 'super_admin', 'scorer', 'content_admin'];

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

export type LoginResult =
  | { ok: true; accessToken: string; expiresIn: string; user: { id: string; email: string; name: string; role: string } }
  | { ok: false; statusCode: number; message: string };

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwt: JwtService,
  ) {}

  /** Create the first super admin from ADMIN_EMAIL / ADMIN_PASSWORD if no admin exists yet. */
  async onModuleInit() {
    try {
      const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
      const password = process.env.ADMIN_PASSWORD;
      if (!email || !password) return;
      const anyAdmin = await this.userModel.exists({ role: { $in: ADMIN_ROLES } });
      if (anyAdmin) return;
      if (password.length < 8) {
        this.logger.error('ADMIN_PASSWORD must be at least 8 characters; admin user not created');
        return;
      }
      await new this.userModel({
        email,
        password, // hashed by the schema pre-save hook
        name: process.env.ADMIN_NAME || 'Administrator',
        role: 'super_admin',
        isActive: true,
        isVerified: true,
        emailVerified: true,
      }).save();
      this.logger.log(`Seeded initial super admin: ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to seed admin user: ${error.message}`);
    }
  }

  async login(emailRaw: string, password: string): Promise<LoginResult> {
    const email = String(emailRaw || '').toLowerCase().trim();
    const generic: LoginResult = { ok: false, statusCode: 401, message: 'Invalid email or password' };
    if (!email || !password) return generic;

    const state = this.failures.get(email);
    if (state && state.lockedUntil > Date.now()) {
      return { ok: false, statusCode: 429, message: 'Too many failed attempts. Try again in a few minutes.' };
    }

    const user = await this.userModel.findOne({ email }).select('+password').exec();
    const valid = !!user && user.isActive && ADMIN_ROLES.includes(user.role) && (await bcrypt.compare(password, user.password));
    if (!valid || !user) {
      const next = { count: (state?.count || 0) + 1, lockedUntil: 0 };
      if (next.count >= MAX_FAILURES) {
        next.lockedUntil = Date.now() + LOCK_MS;
        next.count = 0;
      }
      this.failures.set(email, next);
      return generic;
    }

    this.failures.delete(email);
    await this.userModel.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() }, $inc: { loginCount: 1 } });

    const expiresIn = process.env.JWT_EXPIRES_IN || '12h';
    const accessToken = await this.jwt.signAsync(
      { sub: String(user._id), email: user.email, role: user.role, name: user.name },
      { expiresIn },
    );
    return { ok: true, accessToken, expiresIn, user: { id: String(user._id), email: user.email, name: user.name, role: user.role } };
  }
}
