interface SelectionResponse {
  contentHTMLTags: string[];
  citationData: Array<{ name: string; content: string }>;
  identifier: { idType: string; id: string };
  article: any;
  allContent: string;
  highlighted: string;
  metadata: {
    doi: string;
    title: string;
  };
}
type Result<T,E> = {data:T, error:null}|{data:null, error:E}
