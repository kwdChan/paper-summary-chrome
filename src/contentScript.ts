'use strict';
import { webURL } from './vars';

// Content script file will run in the context of web page.
// With content script you can manipulate the web pages using
// Document Object Model (DOM).
// You can also pass information to the parent extension.

// We execute this script by making an entry in manifest.json file
// under `content_scripts` property

// For more information on Content Scripts,
// See https://developer.chrome.com/extensions/content_scripts


// // Log `title` of current active web page
// const pageTitle = document.head.getElementsByTagName('title')[0]?.innerHTML || "";


function getUnnestedContents(element:Element|Document, contentTags:string[]):Element[] {
  if (!element) {
    return [];
  }
  console.log(element)
  const noNestedContent = !element.querySelector(contentTags.join(','));

  if (noNestedContent) {
    if (element instanceof Document) throw new Error('Document should get to this point');

    const isContent = contentTags.includes(element.tagName!.toLowerCase());

    if (isContent) {
      return [element];
    } else {
      return [];
    }
  }

  const contents = [];
  if (!noNestedContent) {
    for (const child of element.children) {
      contents.push(...getUnnestedContents(child, contentTags));
    }
  }
  return contents;
}

function segmentBy(elementList:any, tagOrder:string[], segmentByTag:string) {
  const segmentTagIndex = tagOrder.indexOf(segmentByTag);

  const allSegments = [];
  let newSegment:any = [];
  for (const e of elementList) {
    const eTagOrder = tagOrder.indexOf(e[0]);
    if (eTagOrder > segmentTagIndex) {
      newSegment.push(e);
    }

    if (eTagOrder <= segmentTagIndex) {
      allSegments.push(newSegment);
      newSegment = [e];
    }
  }

  allSegments.push(newSegment);
  return allSegments;
}

function asPrompt(segment:[string, string]) {
  let prompt = '';
  for (const eachTag of segment) {
    prompt += `<${eachTag[0]}> ${eachTag[1]} </${eachTag[0]}> \n\n`;
  }

  return prompt;
}

function segmentHtmlOnThisDocument(
  contentTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'p']
) {
  const unnestedContentElements = getUnnestedContents(document, contentTags);
  const tagAndText = unnestedContentElements.map((e) => [
    e.tagName.toLowerCase(),
    e.textContent?.replace('\xa0', ' ').replace('\u200b', '') || '',
  ]);

  const segments = segmentBy(tagAndText, contentTags, 'h3');
  return segments.filter((s) => s.length).map(asPrompt);
}

function getContentList() {
  const tags = [
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'span',
    'div',
    'article',
  ];
  let contentList:string[] = [];
  tags.forEach((tag) => {
    let contents = document.getElementsByTagName(tag);
    for (var i = 0; i < contents.length; i++) {
      contentList.push(contents[i].outerHTML.toString());
    }
  });
  return contentList;
}
// send the article to the server if it exists. send only the webpage identifier and highlight otherwise
function getArticle() {
  // TODO: it works so i don't wanna touch it for now

  // @ts-ignore
  let articles = document.getElementsByTagName(['article']);

  // Loop through the HTMLCollection and compare the textContent of each element
  let longestElement = null;
  for (var i = 0; i < articles.length; i++) {
    if (

      !longestElement ||
      // @ts-ignore
      articles[i].textContent.length > longestElement.textContent.length
    ) {
      longestElement = articles[i];
    }
  }
  return longestElement;
}

function getCitationData() {
  const citationMetaTags = document.querySelectorAll<HTMLMetaElement>('meta[name^="citation_"]');

  let citationDataList:Array<{ name:string, content: string }> = [];
  citationMetaTags.forEach((e) => {
    citationDataList.push({ name: e.name, content: e.content });
  });
  return citationDataList;
}
function getMetadata(citationDataList:Array<{ name:string, content: string }>) {
  /*

  1. doi
  2. citiation title
  3. webpage title
  4. null
  */

  // use citation data to identify the webpage
  let doi = citationDataList.filter((e) => e.name === 'citation_doi')[0]
    ?.content;
  let citationTitle = citationDataList.filter(
    (e) => e.name === 'citation_title'
  )[0]?.content;
  let webpageTitle = document.getElementsByTagName('title')[0]?.textContent;

  return {
    doi: doi || '',
    title: citationTitle || webpageTitle || '',
  };
}


// Listen for messages
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message == 'selection') {
    const citationData = getCitationData(); //Array<{name:string,content:string}>

    const metadata = getMetadata(citationData); //{doi:string,title:string}
    const identifier = metadata.doi
      ? { idType: 'doi', id: metadata.doi }
      : { idType: 'title', id: metadata.title }; //{idType:<'doi'|'citation_title'|'webpage_title'>,'id':string}

    const article = getArticle()?.outerHTML.toString();
    const highlighted = window!.getSelection()!.toString();
    const contentList = getContentList();

    sendResponse({
      contentHTMLTags: getUnnestedContents(document, [
        'p',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'ul',
        'ol',
//        'article',
      ]).map(e=>e.outerHTML.toString()),
      //segmented: segmentHtmlOnThisDocument(),
      citationData: citationData,
      identifier: identifier,
      article: article,
      allContent: JSON.stringify(contentList),
      highlighted: highlighted,
      metadata: metadata,
    });
  }
});

// Listen for message
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   // console.log('request', request)
//   if ((request.message == 'addTrace') && (window.location.origin == webURL)){
//     addTrace()
//   }
// });

function addTrace() {
  if (window.location.origin != webURL) return;
  if (document.querySelector("meta[name='review-express-extension']")) return;
  var metadataElement = document.createElement('meta');
  metadataElement.setAttribute('name', 'review-express-extension');
  metadataElement.setAttribute('content', 'review-express-extension');
  document.head.appendChild(metadataElement);
}
addTrace()

async function receiveMessage(event:MessageEvent<any>){
  if (event.origin != webURL) return;
  if (!['signin', 'signout'].includes(event.data.message)) return;
  chrome.runtime.sendMessage({message:event.data.message, payload: event.data.payload});

}

(()=>{

  if (window.location.origin != webURL) return;
  window.addEventListener('message', receiveMessage, false);

})()

