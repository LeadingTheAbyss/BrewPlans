import urllib.request

url = "https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson"
output_path = "public/india.geojson"

try:
    print(f"Downloading from {url}...")
    urllib.request.urlretrieve(url, output_path)
    print(f"Successfully downloaded map to {output_path}")
except Exception as e:
    print(f"Error: {e}")
