import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from './entities/user.entity';
import { UserFollow } from './entities/user-follow.entity';
import { ZcTransaction } from './entities/zc-transaction.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ZcWalletController } from './zc-wallet.controller';
import { ZcWalletService } from './zc-wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserFollow, ZcTransaction]), AuthModule],
  controllers: [UsersController, ZcWalletController],
  providers: [UsersService, ZcWalletService],
  exports: [UsersService, ZcWalletService],
})
export class UsersModule {}
