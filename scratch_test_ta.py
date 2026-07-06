import asyncio
import httpx

async def test_tripadvisor():
    api_key = "90eb5451-53e4-4e83-9a66-f8c4d3b86fb8"
    search_url = f"https://api.content.tripadvisor.com/api/v1/location/search"
    search_params = {
        "searchQuery": "India Gate",
        "latLong": "28.6129,77.2295",
        "key": api_key,
        "language": "en"
    }
    headers = {"accept": "application/json"}
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(search_url, params=search_params, headers=headers)
        print("Search Status:", resp.status_code)
        data = resp.json()
        print("Search Data:", data)
        
        if data.get("data"):
            location_id = data["data"][0]["location_id"]
            photo_url = f"https://api.content.tripadvisor.com/api/v1/location/{location_id}/photos"
            photo_params = {"key": api_key, "language": "en"}
            
            p_resp = await client.get(photo_url, params=photo_params, headers=headers)
            print("Photo Status:", p_resp.status_code)
            p_data = p_resp.json()
            # print("Photo Data:", p_data)
            
            if p_data.get("data"):
                images = p_data["data"][0].get("images", {})
                large_url = images.get("large", {}).get("url")
                print("Large URL:", large_url)

asyncio.run(test_tripadvisor())
