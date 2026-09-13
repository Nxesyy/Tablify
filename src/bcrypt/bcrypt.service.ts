import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

@Injectable()
export class BcryptService {
    async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        return await hash(password, saltRounds);
    }
    async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
        return await compare(password, hashedPassword);
    }
}