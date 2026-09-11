const fs = require('fs');

const TARGET_CITY = 'Kano';

// We use geocodeArea in Overpass to find the city
const query = `
  [out:json][timeout:25];
  area["name"="${TARGET_CITY}"]->.searchArea;
  (
    node["amenity"="clinic"](area.searchArea);
    node["amenity"="hospital"](area.searchArea);
    node["healthcare"="laboratory"](area.searchArea);
  );
  out body;
`;

const url = 'https://overpass-api.de/api/interpreter';

async function fetchLeads() {
  console.log(`\n🔍 Searching OpenStreetMap for medical facilities in ${TARGET_CITY}...`);

  try {
    const getUrl = `${url}?data=${encodeURIComponent(query)}`;
    const response = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'RedianScraper/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      console.error(await response.text());
      return;
    }

    const parsedData = await response.json();
    const elements = parsedData.elements;
    
    if (!elements || elements.length === 0) {
      console.log(`❌ No medical facilities found in ${TARGET_CITY}. Try a different city or check spelling.`);
      return;
    }

    console.log(`✅ Found ${elements.length} potential leads! Extracting data...`);

    let csvContent = 'Name,Type,Phone,Address,Lat,Lon\n';

    elements.forEach(el => {
      if (el.tags) {
        const name = el.tags.name ? el.tags.name.replace(/,/g, '') : 'Unknown';
        const type = el.tags.healthcare || el.tags.amenity || 'clinic';
        const phone = el.tags.phone || el.tags['contact:phone'] || 'N/A';
        
        const street = el.tags['addr:street'] || '';
        const housenumber = el.tags['addr:housenumber'] || '';
        const city = el.tags['addr:city'] || '';
        let address = `${housenumber} ${street} ${city}`.trim().replace(/,/g, '');
        if (!address) address = 'N/A';

        csvContent += `"${name}","${type}","${phone}","${address}",${el.lat},${el.lon}\n`;
      }
    });

    const filename = `leads_${TARGET_CITY.toLowerCase()}.csv`;
    fs.writeFileSync(filename, csvContent);
    console.log(`🎉 Success! Saved ${elements.length} leads to ${filename}`);

  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchLeads();
