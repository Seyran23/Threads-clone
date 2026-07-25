import { UserResponse } from '@/modules/users/response/user.response';

import { PostSearchResultResponse } from './post-search-result.response';

export class SearchResultsResponse {
  posts!: PostSearchResultResponse[];
  users!: UserResponse[];
}
