export class CreateRefreshTokenDto {
  userId!: string;
  tokenHash!: string;
  familyId!: string;
  expiresAt!: Date;
}
