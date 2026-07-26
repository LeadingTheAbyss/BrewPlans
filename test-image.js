const fetch = require('node-fetch'); // or native fetch in Node 18+

async function test() {
  const url = "http://localhost:3000/api/image?name=places/ChIJZVzagmTjmzkRcp8k7y4M72Y/photos/AaVGc3n99RqWx2PZc6qcoyGUI-eI_wtZqiOUcxyZBbKRaNT2iPK-yxYLzprAHOn9CE2ZiqxHecRfTSky99AWIqFbjpADB1EeF9E53f4XL0kOB1OfyxYxUtXnksHe-uaQBtwrY4iBUB9fKTtCFbCXbMibP7V2bedEFIeB0lPKBPTz2E7B1hxxKYmJ8C18toU3v0KSfPrUOaQwxC1-KP8dvjSo87u4oRMimohbg9-xS0_Yp3h5M0kM3-rYj92VJENnbimRXIVnfwJN4ihovxtSXKCg5WN3b8awrriv8r0smLm5X2k8TE6bW1jA_xL7n2rtRZ5KT1n-B6OERhDNECcYKw2_q-L3IE1v9sE3ILFthKkTYptcvX3bGuDN5XgwMPbas0lIrxh-vX3zJgqxNkb9ab9_5XdZf2FNxiFJKvVyAacDIYdCSA&maxWidth=800";
  try {
    const res = await fetch(url);
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    if (!res.ok) {
        console.log("Error text:", await res.text());
    } else {
        console.log("Success! Bytes:", (await res.buffer()).length);
    }
  } catch (e) {
    console.error(e);
  }
}
test();
