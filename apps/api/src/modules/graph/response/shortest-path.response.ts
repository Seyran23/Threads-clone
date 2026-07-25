import { GraphUserResponse } from './graph-user.response';

export class ShortestPathResponse {
  path!: GraphUserResponse[] | null;
  length!: number | null;
}
