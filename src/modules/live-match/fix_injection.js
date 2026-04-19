const fs = require('fs');
const path = 'f:\\coding\\Cricket Project\\cricket-backend\\main-app\\src\\modules\\live-match\\live-match.service.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Ensure RedisPublisherService is imported
if (!content.includes("from '../../common/redis/redis-publisher.service'")) {
    content = "import { RedisPublisherService } from '../../common/redis/redis-publisher.service';\n" + content;
}

// 2. Inject into constructor
if (!content.includes('private readonly redisPublisher: RedisPublisherService')) {
    const constructorMatch = /constructor\([\s\S]*?private readonly responseService: ResponseService,?\s*\) \{ \}/;
    content = content.replace(constructorMatch, (match) => {
        return match.replace(
            'private readonly responseService: ResponseService,',
            'private readonly responseService: ResponseService,\n    private readonly redisPublisher: RedisPublisherService,'
        ).replace(
            'private readonly responseService: ResponseService)',
            'private readonly responseService: ResponseService,\n    private readonly redisPublisher: RedisPublisherService)'
        );
    });
}

fs.writeFileSync(path, content, 'utf8');
console.log('Injection patched successfully.');
