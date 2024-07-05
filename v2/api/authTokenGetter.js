// defineModule(function () {
//     class AuthTokenGetter {
//         static tokenCacheKey = 'authTokenCache';

//         constructor(account, privateKey, base64Implementation) {
//             this.account = account;
//             this.privateKey = privateKey;
//             this.base64Implementation = base64Implementation;

//             // Load cache from localStorage
//             const cachedData = localStorage.getItem(AuthTokenGetter.tokenCacheKey);
//             AuthTokenGetter.tokenCache = cachedData ? JSON.parse(cachedData) : {};
//         }

//         static saveCacheToLocalStorage() {
//             localStorage.setItem(AuthTokenGetter.tokenCacheKey, JSON.stringify(AuthTokenGetter.tokenCache));
//         }

//         async createJwtToken() {
//             const header = {
//                 alg: "RS256",
//                 typ: "JWT"
//             };

//             const now = Math.floor(Date.now() / 1000);
//             const expiry = now + 3600; // 1 hour

//             const claims = {
//                 iss: this.account,
//                 scope: "https://www.googleapis.com/auth/firebase.messaging",
//                 aud: "https://oauth2.googleapis.com/token",
//                 iat: now,
//                 exp: expiry
//             };

//             const encodedHeader = this.base64Implementation.encode(JSON.stringify(header));
//             const encodedClaims = this.base64Implementation.encode(JSON.stringify(claims));
//             const unsignedToken = `${encodedHeader}.${encodedClaims}`;

//             const createSignature = async () => {
//                 const privateKeyContent = this.privateKey
//                     .replace(/\n/g, '')
//                     .replace("-----BEGIN PRIVATE KEY-----", '')
//                     .replace("-----END PRIVATE KEY-----", '');

//                 const keyBytes = this.base64Implementation.decode(privateKeyContent);
//                 const key = await crypto.subtle.importKey(
//                     'pkcs8',
//                     keyBytes,
//                     { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
//                     false,
//                     ["sign"]
//                 );

//                 const signature = await crypto.subtle.sign(
//                     "RSASSA-PKCS1-v1_5",
//                     key,
//                     new TextEncoder().encode(unsignedToken)
//                 );

//                 return this.base64Implementation.encode(signature);
//             };

//             const signature = await createSignature();
//             return `${unsignedToken}.${signature}`;
//         }

//         async getAccessToken() {
//             const currentTime = Math.floor(Date.now() / 1000);

//             const existingToken = AuthTokenGetter.tokenCache[this.account];
//             if (existingToken && currentTime < existingToken.expiryTime) {
//                 console.log("Using existing auth token");
//                 return existingToken.token;
//             }

//             console.log("Getting new auth token");
//             const jwtToken = await this.createJwtToken();

//             const response = await fetch('https://oauth2.googleapis.com/token', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/x-www-form-urlencoded'
//                 },
//                 body: new URLSearchParams({
//                     'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
//                     'assertion': jwtToken
//                 })
//             });

//             if (!response.ok) {
//                 const errorText = await response.text();
//                 throw new Error(`Auth token unexpected response code ${response.status}. Error: ${errorText}`);
//             }

//             const tokenResponse = await response.json();
//             if (!tokenResponse.access_token || !tokenResponse.expires_in) {
//                 throw new Error("Auth token couldn't parse token response");
//             }

//             const accessToken = tokenResponse.access_token;
//             const newCachedToken = { token: accessToken, expiryTime: currentTime + tokenResponse.expires_in };
//             AuthTokenGetter.tokenCache[this.account] = newCachedToken;

//             // Save cache to localStorage
//             AuthTokenGetter.saveCacheToLocalStorage();

//             return accessToken;
//         }
//     }

//     const Base64Implementation = {
//         encode: (data) => {
//             const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
//             return btoa(String.fromCharCode(...new Uint8Array(bytes)));
//         },
//         decode: (data) => {
//             const binaryString = atob(data);
//             const len = binaryString.length;
//             const bytes = new Uint8Array(len);
//             for (let i = 0; i < len; i++) {
//                 bytes[i] = binaryString.charCodeAt(i);
//             }
//             return bytes.buffer;
//         }
//     };
//     return {
//         AuthTokenGetter,
//         Base64Implementation
//     };
// });