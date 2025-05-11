import { NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const { url, options } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { message: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { message: 'Invalid URL format. Please provide a valid website address (e.g., https://example.com)' },
        { status: 400 }
      );
    }
    
    // Initialize collection for discovered URLs and content
    const discoveredUrls: Set<string> = new Set();
    let aggregatedContent = '';
    
    // Parse the base URL to help with resolving relative links
    const baseUrl = new URL(url);
    
    // Queue for breadth-first crawling
    const urlQueue: { url: string; depth: number }[] = [{ url, depth: 0 }];
    const visitedUrls: Set<string> = new Set();
    
    // Try to fetch the initial URL first to validate it exists
    try {
      await axios.head(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebsiteCrawler/1.0; +http://yourwebsite.com/bot)'
        }
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNREFUSED') {
          return NextResponse.json(
            { message: 'Could not connect to the website. Please check if the website is accessible.' },
            { status: 502 }
          );
        }
        if (error.code === 'ENOTFOUND') {
          return NextResponse.json(
            { message: 'Website not found. Please check if the domain exists.' },
            { status: 404 }
          );
        }
        if (error.code === 'ETIMEDOUT') {
          return NextResponse.json(
            { message: 'Connection timed out. The website took too long to respond.' },
            { status: 504 }
          );
        }
        if (error.response?.status === 403) {
          return NextResponse.json(
            { message: 'Access to this website is forbidden.' },
            { status: 403 }
          );
        }
        if (error.response?.status === 404) {
          return NextResponse.json(
            { message: 'The requested page was not found on this website.' },
            { status: 404 }
          );
        }
        if (error.response?.status === 401) {
          return NextResponse.json(
            { message: 'This website requires authentication.' },
            { status: 401 }
          );
        }
      }
      return NextResponse.json(
        { message: 'Failed to access the website. Please check if the URL is correct and the website is accessible.' },
        { status: 500 }
      );
    }
    
    // Process URLs up to the maximum depth
    while (urlQueue.length > 0) {
      const { url: currentUrl, depth } = urlQueue.shift()!;
      
      if (visitedUrls.has(currentUrl) || depth > (options.maxDepth || 2)) {
        continue;
      }
      
      try {
        // Check robots.txt if enabled
        if (options.respectRobotsTxt) {
          const robotsUrl = new URL('/robots.txt', baseUrl.origin);
          try {
            const robotsResponse = await axios.get(robotsUrl.toString(), { timeout: 5000 });
            if (robotsResponse.data.includes(`Disallow: ${new URL(currentUrl).pathname}`)) {
              continue;
            }
          } catch (error) {
            // If robots.txt doesn't exist or can't be fetched, we'll proceed
          }
        }
        
        visitedUrls.add(currentUrl);
        discoveredUrls.add(currentUrl);
        
        const response = await axios.get(currentUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WebsiteCrawler/1.0; +http://yourwebsite.com/bot)'
          },
          validateStatus: (status) => status === 200, // Only accept 200 OK responses
        });
        
        // Only process HTML content
        const contentType = response.headers['content-type'] || '';
        if (!contentType.includes('text/html')) {
          continue;
        }
        
        // Parse HTML
        const $ = cheerio.load(response.data);
        
        // Remove navigation if specified
        if (options.excludeNavigation) {
          $('nav, header, footer, aside, .navigation, .menu, .nav').remove();
        }
        
        // Extract text content from the body
        let pageContent = '';
        
        $('p, h1, h2, h3, h4, h5, h6, li, td, th, dl, dt, dd, blockquote, figcaption, pre, code').each((_, element) => {
          const text = $(element).text().trim();
          if (text) {
            pageContent += text + '\n\n';
          }
        });
        
        aggregatedContent += `--- Content from ${currentUrl} ---\n\n${pageContent}\n\n`;
        
        if (!options.crawlSubpages || depth >= (options.maxDepth || 2)) {
          continue;
        }
        
        $('a[href]').each((_, element) => {
          try {
            const href = $(element).attr('href');
            if (!href) return;
            
            let resolvedUrl: URL;
            try {
              resolvedUrl = new URL(href, currentUrl);
            } catch {
              return;
            }
            
            if (resolvedUrl.hostname !== baseUrl.hostname) {
              return;
            }
            
            if (
              href.startsWith('#') ||
              href.startsWith('javascript:') ||
              href.startsWith('mailto:') ||
              href.startsWith('tel:')
            ) {
              return;
            }
            
            resolvedUrl.hash = '';
            
            const normalizedUrl = resolvedUrl.toString();
            
            if (!visitedUrls.has(normalizedUrl)) {
              urlQueue.push({ url: normalizedUrl, depth: depth + 1 });
            }
          } catch (error) {
            // Skip problematic links
          }
        });
      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error);
        continue;
      }
    }
    
    if (aggregatedContent.trim().length === 0) {
      return NextResponse.json(
        { message: 'No content could be extracted from the website.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      content: aggregatedContent.trim(),
      crawledUrls: Array.from(discoveredUrls)
    });
    
  } catch (error) {
    console.error('Error processing website crawl request:', error);
    return NextResponse.json(
      { 
        message: error instanceof Error ? error.message : 'Failed to crawl website',
        error: error instanceof Error ? error.name : 'Unknown error'
      },
      { status: 500 }
    );
  }
}