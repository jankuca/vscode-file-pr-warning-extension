export const OPEN_PRS_QUERY = `
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequests(
      states: OPEN,
      first: 50,
      after: $cursor,
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        title
        url
        isDraft
        reviewDecision
        createdAt
        updatedAt
        headRefName
        author {
          login
        }
        files(first: 100) {
          pageInfo {
            hasNextPage
          }
          nodes {
            path
          }
        }
      }
    }
  }
}
`;

export interface GraphQLPRNode {
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  createdAt: string;
  updatedAt: string;
  headRefName: string;
  author: { login: string } | null;
  files: {
    pageInfo: { hasNextPage: boolean };
    nodes: { path: string }[];
  };
}

export interface GraphQLPRResponse {
  data: {
    repository: {
      pullRequests: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: GraphQLPRNode[];
      };
    } | null;
  };
  errors?: { message: string }[];
}

export interface RESTFileEntry {
  sha: string;
  filename: string;
  status: string;
  patch?: string;
}
