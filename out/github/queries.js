"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_PRS_QUERY = void 0;
exports.OPEN_PRS_QUERY = `
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
//# sourceMappingURL=queries.js.map