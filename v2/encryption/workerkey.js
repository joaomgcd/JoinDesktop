self.importScripts('pbkdf2.js');
self.importScripts('aes.js');
onmessage = function(e) {
	var args = e.data;
	var key256Bits = CryptoJS.PBKDF2(args.password, args.salt, { keySize: 256/32, iterations: args.iterations });
	var keyString = CryptoJS.enc.Base64.stringify(key256Bits);
	postMessage(keyString);
};