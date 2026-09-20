const https = require('https');

const tmdbId = 1429; // Attack on Titan

const urls = [
  `https://vidlink.pro/tv/${tmdbId}/1/1`,
  `https://anime.vidsrc.me/embed/anime?tmdb=${tmdbId}`,
  `https://vidsrc.to/embed/anime/${tmdbId}`,
  `https://vidsrc.cc/v3/embed/anime/${tmdbId}`,
  `https://embed.smashystream.com/play1.php?tmdb=${tmdbId}`
];

urls.forEach(url => {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    console.log(`${url} -> Status: ${res.statusCode} ${res.headers.location ? 'Location: ' + res.headers.location : ''}`);
  }).on('error', (e) => {
    console.error(`Error for ${url}: ${e.message}`);
  });
});
