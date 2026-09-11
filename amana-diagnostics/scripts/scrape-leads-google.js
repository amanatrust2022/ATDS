const fs = require('fs');

// ==========================================
// CONFIGURATION
// ==========================================
// 1. Get your API key from Google Cloud Console (https://console.cloud.google.com/)
// 2. Enable the "Places API (New)" for your project
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDhr9EZy0uxNnDB5TTHvpt9arJ1qAAou9I';

const TARGET_CITY = 'Kano, Nigeria';
const SEARCH_QUERIES = [
  `diagnostic center in ${TARGET_CITY}`,
  `medical laboratory in ${TARGET_CITY}`,
  `medical clinic in ${TARGET_CITY}`
];

// We use the new Google Places API (Text Search)
const url = 'https://places.googleapis.com/v1/places:searchText';

async function fetchGoogleLeads() {
  if (GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY_HERE') {
    console.error('❌ Please add your Google API Key to the script or set GOOGLE_MAPS_API_KEY in your environment.');
    return;
  }

  console.log(`\n🔍 Searching Google Maps for highly qualified leads in ${TARGET_CITY}...`);

  let allLeads = [];
  let seenPlaces = new Set(); // To prevent duplicates

  for (const query of SEARCH_QUERIES) {
    console.log(`Searching: "${query}"...`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          // We ask Google exactly for the fields we need to save money and get clean data
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryType'
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode: 'en'
        })
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
        console.error(await response.text());
        continue;
      }

      const data = await response.json();

      if (data.places) {
        data.places.forEach(place => {
          const name = place.displayName ? place.displayName.text : 'Unknown';

          // Avoid duplicates if multiple queries find the same lab
          if (!seenPlaces.has(name)) {
            seenPlaces.add(name);
            allLeads.push(place);
          }
        });
      }
    } catch (error) {
      console.error(`Error fetching "${query}":`, error);
    }
  }

  if (allLeads.length === 0) {
    console.log('❌ No leads found. Check your API key or query.');
    return;
  }

  console.log(`✅ Found ${allLeads.length} unique leads! Formatting to CSV...`);

  // Prepare CSV content (World Standard Prospect List format)
  let csvContent = 'Company Name,Category,Phone Number,Website,Google Rating,Reviews,Address\n';

  allLeads.forEach(place => {
    const name = place.displayName ? place.displayName.text.replace(/,/g, '') : 'Unknown';
    const type = place.primaryType || 'N/A';
    const phone = place.nationalPhoneNumber || 'No Phone';
    const website = place.websiteUri || 'No Website';
    const rating = place.rating || 'N/A';
    const reviews = place.userRatingCount || '0';
    let address = place.formattedAddress ? place.formattedAddress.replace(/,/g, '') : 'N/A';

    csvContent += `"${name}","${type}","${phone}","${website}","${rating}","${reviews}","${address}"\n`;
  });

  const filename = `google_leads_${TARGET_CITY.split(',')[0].toLowerCase().replace(' ', '_')}.csv`;
  fs.writeFileSync(filename, csvContent);
  console.log(`🎉 Success! Saved ${allLeads.length} premium leads to ${filename}`);
}

fetchGoogleLeads();
