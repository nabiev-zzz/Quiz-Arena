import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentProvider } from './entities/subscription-payment.entity';
import { SubscriptionPaymentsService } from './subscription-payments.service';

interface AuthRequest { user: { id: string } }
interface CheckoutBody { provider: PaymentProvider; planKey: string }
interface GooglePurchaseBody { purchaseToken: string }
type ClickBody = Record<string, string | number | undefined>;
interface PaymeBody { id?: number; method?: string; params?: Record<string, any> }

@Controller('api/subscriptions')
export class SubscriptionPaymentsController {
  constructor(private readonly payments: SubscriptionPaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(@Request() request: AuthRequest, @Body() body: CheckoutBody) {
    return this.payments.createCheckout(request.user.id, body?.provider, body?.planKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('google-play/verify')
  googlePlayVerify(@Request() request: AuthRequest, @Body() body: GooglePurchaseBody) {
    return this.payments.verifyGooglePlayPurchase(request.user.id, body?.purchaseToken);
  }

  @Post('google-play/notifications')
  @HttpCode(HttpStatus.OK)
  googlePlayNotifications(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { message?: { data?: string }; subscription?: string },
  ) {
    return this.payments.handleGooglePlayNotification(authorization, body ?? {});
  }

  @Post('click')
  @HttpCode(HttpStatus.OK)
  click(@Body() body: ClickBody) {
    return this.payments.clickCallback(body ?? {});
  }

  @Post('payme')
  @HttpCode(HttpStatus.OK)
  payme(@Headers('authorization') authorization: string | undefined, @Body() body: PaymeBody) {
    return this.payments.paymeCallback(authorization, body ?? {});
  }
}
