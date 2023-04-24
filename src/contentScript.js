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

// Log `title` of current active web page
const pageTitle = document.head.getElementsByTagName('title')[0].innerHTML;

console.log(
  `Page title is: '${pageTitle}' - evaluated by Chrome extension's 'contentScript.js' file`
);

function getUnnestedContents(element, contentTags) {
  if (!element) {
    return [];
  }
  console.log(element)
  const noNestedContent = !element.querySelector(contentTags.join(','));

  if (noNestedContent) {
    const isContent = contentTags.includes(element.tagName.toLowerCase());

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

function segmentBy(elementList, tagOrder, segmentByTag) {
  const segmentTagIndex = tagOrder.indexOf(segmentByTag);

  const allSegments = [];
  let newSegment = [];
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

function asPrompt(segment) {
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
    e.textContent.replace('\xa0', ' ').replace('\u200b', ''),
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
  let contentList = [];
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
  let articles = document.getElementsByTagName(['article']);
  // Loop through the HTMLCollection and compare the textContent of each element
  let longestElement = null;
  for (var i = 0; i < articles.length; i++) {
    if (
      !longestElement ||
      articles[i].textContent.length > longestElement.textContent.length
    ) {
      longestElement = articles[i];
    }
  }
  return longestElement;
}

function getCitationData() {
  const citationMetaTags = document.querySelectorAll('meta[name^="citation_"]');

  let citationDataList = [];
  citationMetaTags.forEach((e) => {
    citationDataList.push({ name: e.name, content: e.content });
  });
  return citationDataList;
}
function getMetadata(citationDataList) {
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


function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'my-sidebar';
  sidebar.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100%;
    background-color: #f0f0f0;
    border-right: 1px solid #ccc;
    overflow: auto;
    z-index: 9999;
    padding: 10px;
    box-sizing: border-box;
  `;
  const webapp = document.createElement('iframe');
  webapp.src = webURL

  webapp.style.cssText = `
  width: 100%;
  height: 100%;
  border: 0;
  overflow: hidden;
`;
  sidebar.appendChild(webapp)

  document.body.appendChild(sidebar);


  const removeSidebar = adjustMainContent(sidebar.offsetWidth);



}

function adjustMainContent(sidebarWidth) {
  const originalBodyMarginRight = document.body.style.marginRight || '';
  document.body.style.marginRight = `${sidebarWidth}px`;

  // Add a cleanup function to remove the sidebar and restore the original margin
  const removeSidebar = () => {
    const sidebar = document.getElementById('my-sidebar');
    if (sidebar) {
      sidebar.remove();
      document.body.style.marginRight = originalBodyMarginRight;
      window.removeEventListener('unload', removeSidebar);
    }
  };

  // Remove the sidebar and restore the original margin when the page is unloaded
  window.addEventListener('unload', removeSidebar);
  return removeSidebar
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'createSidebar') {
    //createSidebar();
  }
});

// Listen for messages
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message == 'selection') {
    const citationData = getCitationData(); //Array<{name:string,content:string}>

    const metadata = getMetadata(citationData); //{doi:string,title:string}
    const identifier = metadata.doi
      ? { idType: 'doi', id: metadata.doi }
      : { idType: 'title', id: metadata.title }; //{idType:<'doi'|'citation_title'|'webpage_title'>,'id':string}

    const article = getArticle()?.outerHTML.toString();
    const highlighted = window.getSelection().toString();
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'COUNT') {
    console.log(`Current count is ${request.payload.count}`);
  }

  // Send an empty response
  // See https://github.com/mozilla/webextension-polyfill/issues/130#issuecomment-531531890
  sendResponse({});
  return true;
});
