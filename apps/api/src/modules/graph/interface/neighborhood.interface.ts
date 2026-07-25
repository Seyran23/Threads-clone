import { GraphUser } from './graph-user.interface';

export interface Neighborhood {
  centerId: string;
  centerUsername: string;
  following: GraphUser[];
  followers: GraphUser[];
}
