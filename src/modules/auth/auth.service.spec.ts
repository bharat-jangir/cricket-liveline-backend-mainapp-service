import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
    const hash = bcrypt.hashSync('correct-password', 4);
    const mkUser = (over: any = {}) => ({ _id: 'u1', email: 'a@x.com', name: 'A', role: 'super_admin', isActive: true, password: hash, ...over });
    const build = (user: any) => {
        const userModel: any = {
            findOne: jest.fn().mockReturnValue({ select: () => ({ exec: async () => user }) }),
            updateOne: jest.fn(),
        };
        const jwt: any = { signAsync: jest.fn().mockResolvedValue('signed.jwt') };
        return { svc: new AuthService(userModel, jwt), userModel, jwt };
    };

    it('signs a token for valid admin credentials', async () => {
        const { svc, jwt } = build(mkUser());
        const res: any = await svc.login(' A@X.com ', 'correct-password');
        expect(res.ok).toBe(true);
        expect(res.accessToken).toBe('signed.jwt');
        expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ sub: 'u1', role: 'super_admin' });
    });

    it('rejects wrong password, unknown user, inactive user and non-admin roles with the same message', async () => {
        for (const [user, pw] of [[mkUser(), 'nope'], [null, 'correct-password'], [mkUser({ isActive: false }), 'correct-password'], [mkUser({ role: 'user' }), 'correct-password']] as any) {
            const { svc } = build(user);
            expect(await svc.login('a@x.com', pw)).toEqual({ ok: false, statusCode: 401, message: 'Invalid email or password' });
        }
    });

    it('locks the account after 5 failed attempts, even for the right password', async () => {
        const { svc } = build(mkUser());
        for (let i = 0; i < 5; i++) await svc.login('a@x.com', 'bad');
        const res: any = await svc.login('a@x.com', 'correct-password');
        expect(res.ok).toBe(false);
        expect(res.statusCode).toBe(429);
    });
});
