import urllib.request, urllib.parse, urllib.error
url = 'http://localhost:3000/api/food?destination=Lucknow'
try:
  print(urllib.request.urlopen(url).read()[:100])
except urllib.error.HTTPError as e:
  print(e.code)
  print(e.read().decode())
