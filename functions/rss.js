// functions/rss.js

export async function onRequest(context) {
    const url = new URL(context.request.url);
    const podcastName = url.searchParams.get('podcast'); // Get podcast name from query parameter
  
    if (!podcastName) {
      return new Response("Error: Missing 'podcast' query parameter. Please specify a podcast name in the URL (e.g., /rss.xml?podcast=pod1).", { status: 400 });
    }
  
    const bucketName = process.env.R2_BUCKET_NAME;
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const publicBucketUrlBase = process.env.R2_ENDPOINT ;
    const podcastPrefix = `${podcastName}/`;
  
    // Ensure environment variables are set
    if (!bucketName || !r2AccessKeyId || !r2SecretAccessKey ) {
      console.error("Missing R2 environment variables!");
      return new Response("Error: Missing R2 configuration. Check environment variables.", { status: 500 });
    }
  
    // Initialize R2 binding
    const r2 = new Cloudflare.R2Binding({
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
      
    });
  
    try {
      const objects = await r2.list({ bucket: bucketName, prefix: podcastPrefix });
      if (!objects.objects || objects.objects.length === 0) {
        return new Response(`No MP3 files found for podcast '${podcastName}'. Please check if the podcast directory '${podcastPrefix}' exists in your R2 bucket and contains MP3 files.`, { status: 404 });
      }
  
      let rssItems = '';
      for (const object of objects.objects) {
        if (object.key.toLowerCase().endsWith('.mp3')) {
          const mp3Url = `${publicBucketUrlBase}/${object.key}`;
          const itemTitle = object.key.substring(podcastPrefix.length);
          const pubDate = new Date(object.uploaded).toUTCString();
  
          rssItems += `
            <item>
              <title>${escapeXml(itemTitle)}</title>
              <link>${escapeXml(mp3Url)}</link>
              <enclosure url="${escapeXml(mp3Url)}" length="${object.size}" type="audio/mpeg"/>
              <pubDate>${pubDate}</pubDate>
            </item>
          `;
        }
      }
  
      const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Podcast: ${podcastName}</title>
            <link>https://${url.host}${url.pathname}?podcast=${podcastName}</link> <!- RSS Link with query parameter -->
            <description>MP3 files for podcast '${podcastName}' hosted on Cloudflare R2</description>
            <pubDate>${new Date().toUTCString()}</pubDate>
            ${rssItems}
          </channel>
        </rss>`;
  
      return new Response(rssFeed, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8'
        }
      });
  
    } catch (error) {
      console.error(`Error fetching from R2 for podcast '${podcastName}':`, error);
      return new Response(`Error generating RSS feed for podcast '${podcastName}'.`, { status: 500 });
    }
  }
  
  function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });
  }