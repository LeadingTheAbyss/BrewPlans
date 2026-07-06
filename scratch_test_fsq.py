import asyncio
import httpx

async def test_foursquare():
    url = "https://api.foursquare.com/v3/places/search"
    headers = {
        "Accept": "application/json",
        "Authorization": "PBC1SMXNXL3JVG2GSF2EU20HQ0PPCK45MSHLKKJN141OAAAC"
    }
    params = {
        "query": "India Gate",
        "ll": "28.6129,77.2295",
        "limit": 1,
        "fields": "fsq_id,photos"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        print("Status:", response.status_code)
        data = response.json()
        print("Data:", data)
        
        if data.get("results"):
            photos = data["results"][0].get("photos", [])
            if photos:
                prefix = photos[0]["prefix"]
                suffix = photos[0]["suffix"]
                print("Image URL:", f"{prefix}original{suffix}")
            else:
                print("No photos found for this place.")

asyncio.run(test_foursquare())
