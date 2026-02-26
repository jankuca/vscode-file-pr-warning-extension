export declare const OPEN_PRS_QUERY = "\nquery($owner: String!, $repo: String!, $cursor: String) {\n  repository(owner: $owner, name: $repo) {\n    pullRequests(\n      states: OPEN,\n      first: 50,\n      after: $cursor,\n      orderBy: { field: UPDATED_AT, direction: DESC }\n    ) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      nodes {\n        number\n        title\n        url\n        isDraft\n        reviewDecision\n        createdAt\n        updatedAt\n        headRefName\n        author {\n          login\n        }\n        files(first: 100) {\n          pageInfo {\n            hasNextPage\n          }\n          nodes {\n            path\n          }\n        }\n      }\n    }\n  }\n}\n";
export interface GraphQLPRNode {
    number: number;
    title: string;
    url: string;
    isDraft: boolean;
    reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
    createdAt: string;
    updatedAt: string;
    headRefName: string;
    author: {
        login: string;
    } | null;
    files: {
        pageInfo: {
            hasNextPage: boolean;
        };
        nodes: {
            path: string;
        }[];
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
        };
    };
    errors?: {
        message: string;
    }[];
}
export interface RESTFileEntry {
    sha: string;
    filename: string;
    status: string;
    patch?: string;
}
//# sourceMappingURL=queries.d.ts.map