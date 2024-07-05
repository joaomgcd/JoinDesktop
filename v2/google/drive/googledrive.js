


class GoogleDrive {
	constructor(tokenGetter) {
		const doGetWithAuthPromise = async url => {
			const token = await tokenGetter()
			return UtilWeb.get({url,token});
		}
		const doPostWithAuthPromise = async (url,contentObject) => {
			const token = await tokenGetter()
			return UtilWeb.post({url,token,contentObject});
		}
		const doPutWithAuthPromise = async (url,contentObject) => {
			const token = await tokenGetter()
			return UtilWeb.put({url,token,contentObject});
		}
		const getUserInfoPromise = async () => {
			return {};
		}
		var me = this;
		var getSearchUrl = function (options) {
			var folderId = options.folderId;
			var fileName = options.fileName;
			if (!folderId) {
				folderId = options.parentId;
			}
			if (!fileName) {
				return Util.errorPromise("No file name provided");
			}
			var query = "name = '" + fileName + "' and trashed = false";
			if (folderId) {
				query = "'" + folderId + "' in parents and " + query;
			}
			var url = "https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query);
			return url;
		};
		me.getFileMetadata = function (options) {
			if (!options.fileId) {
				return Util.errorPromise("Couldn't get file metada. No fileId");
			}
			var url = "https://www.googleapis.com/drive/v3/files/" + options.fileId;
			if (options.fields) {
				url += "?fields=";
				for (var i = 0; i < options.fields.length; i++) {
					if (i > 0) {
						url += "%2C";
					}
					var field = options.fields[i];
					url += field;
				}
			}
			return doGetWithAuthPromise(url);
		};
		me.getFile = function (options = {fileId,fileName,folderId,folderName,getParents,ignoreFolderForGetFile}) {
			if (options.fileId) {
				return Promise.resolve()
					.then(function () {
						return { id: options.fileId };
					});
			}
			return Promise.resolve()
				.then(function () {
					if (!options.folderName || options.getParents || options.ignoreFolderForGetFile) {
						return options;
					}
					else {
						return me.getFolderId(options);
					}
				})
				.then(getSearchUrl)
				.then(doGetWithAuthPromise)
				.then(function (result) {
					var fileName = options.fileName;
					if (!result) {
						return Util.errorPromise("Couldn't get file info for " + fileName);
					}
					if (!result.files || result.files.length == 0) {
						return Util.errorPromise("File doesn't exist on your google drive: " + fileName);
					}
					var fileId = result.files[0].id;
					if (!fileId) {
						return Util.errorPromise("File ID not present for " + fileName);
					}
					var file = result.files[0];
					options.fileId = file.id;
					return file;
				}).then(function (file) {
					if (options.getParents) {
						return getFileParents(file.id)
							.then(function (fileParents) {
								if (fileParents) {
									file.parents = fileParents.parents;
									if (file.parents && file.parents.length > 0) {
										options.folderId = file.parents[0];
									}
								}
								return file;
							});
					}
					else {
						return file;
					}
				})
				.then(file => {
					if (file && file.id) {
						file.url = GoogleDrive.getDownloadUrlFromFileId(file.id);
					}
					return file;
				});
		};
		const getFolderIdForNameAndParentId = function (name, parentId) {
			if (name) {
				name = name.replace("'", "");
			}
			var query = "name='" + name + "' and trashed = false";
			if (parentId) {
				query += " and '" + parentId + "' in parents";
			}
			query = encodeURIComponent(query);
			return doGetWithAuthPromise("https://www.googleapis.com/drive/v3/files?q=" + query)
				.then(function (result) {
					if (!result || !result.files || result.files.length == 0) {
						var createOptions = { "name": name, "mimeType": "application/vnd.google-apps.folder" };
						if (parentId) {
							createOptions.parents = [parentId];
						}
						return { createOptions: createOptions };
					}
					else {
						return { id: result.files[0].id };
					}
				})
				.then(function (result) {
					var createOptions = result.createOptions;
					if (createOptions) {
						return doPostWithAuthPromise("https://www.googleapis.com/drive/v3/files", createOptions);
					}
					else {
						return result;
					}
				})
				.then(function (result) {
					return result.id;
				});
		};
		me.getFolderId = async function (options) {
			var folderName = options.folderName;
			var folderId = options.folderId;
			var parentId = options.parentId;
			if (folderId) {
				return options;
			}
			if (!folderName) {
				return Util.errorPromise("No folder Name provided");
			}
			var setFolderIdOnOptions = function (folderId) {
				options.folderId = folderId;
				return options;
			};
			if (folderName.indexOf("/") >= 0) {
				var split = folderName.split("/");
				let parentId = null;
				for(const part of split){
					parentId = await getFolderIdForNameAndParentId(part,parentId)
				}
				return setFolderIdOnOptions(parentId);
			}
			else {
				return getFolderIdForNameAndParentId(folderName, parentId).then(setFolderIdOnOptions);
			}
		};
		me.uploadFile = function (options) {
			var file = options.file;
			if (!file) {
				return Util.errorPromise("No file to upload");
			}
			options.fileName = file.name;
			console.log("Uploading...");
			console.log(file);
			return uploadNewContent(options)
				.then(function (uploadedFile) {
					if (options.notify) {
						back.showNotification("Join", "Uploaded " + options.fileName);
					}
					options.fileId = uploadedFile.id;
					return options;
				})
				.then(function (options) {
					return me.shareFile(options);
				}).then(function (options) {
					return "https://drive.google.com/file/d/" + options.fileId;
				});
		};
		var getShareUrlAndData = function (options) {
			var userInfo = options.userInfo;
			var userToShareTo = options.userToShareTo;
			var fileId = options.fileId;
			if (!fileId) {
				return Util.errorPromise("No file Id to share");
			}
			if (!userToShareTo) {
				console.log("Not sharing file because no account to share to found");
				return null;
			}
			if (userToShareTo == userInfo.email) {
				console.log("Not sharing file to " + userToShareTo + " because it's not another user");
				return null;
			}
			console.log("Sharing file to " + userToShareTo);
			return { url: "https://www.googleapis.com/drive/v2/files/" + fileId + "/permissions/", data: { "role": "writer", "type": "user", "value": userToShareTo } };
		};
		me.shareFile = function (options) {
			//options.userToShareTo = "jakuxes@gmail.com";
			return getUserInfoPromise()
				.then(function (userInfo) {
					options.userInfo = userInfo;
					return options;
				})
				.then(getShareUrlAndData)
				.then(function (urlAndData) {
					if (!urlAndData) {
						return null;
					}
					return doPostWithAuthPromise(urlAndData.url, urlAndData.data);
				}).then(function (resultShareFile) {
					if (resultShareFile) {
						console.log("Share file result:");
						console.log(resultShareFile);
					}
					return options;
				});
		};
		me.uploadFiles = function (options, filesToUpload) {
			return me.getFolderId(options)
				.then(function (options) {
					var optionsArray = [];
					for (var i = 0; i < filesToUpload.length; i++) {
						var file = filesToUpload[i];
						var newOptions = Object.assign({},options);
						newOptions.file = file;
						optionsArray.push(newOptions);
					}
					return optionsArray;
				})
				.then(function (optionsArray) {
					return Promise.all(optionsArray.map(options=>me.uploadFile(options)));					
				});
		};
		var overwriteContent = function (options) {
			return prepareContent(options)
				.then(function (options) {
					var fileId = options.fileId;
					var content = options.content;
					return doPutWithAuthPromise("https://www.googleapis.com/upload/drive/v2/files/" + fileId + "?uploadType=multipart", content);
				});
		};
		var prepareContent = function (options) {
			return new Promise(function (resolve, reject) {
				var content = options.content;
				var file = options.file;
				if (file) {
					content = file;
				}
				if (!content) {
					reject("No content for upload");
				}
				options.content = content;
				resolve(options);
			});
		};
		var prepareContentAndFolderId = function (options) {
			return prepareContent(options)
				.then(me.getFolderId);
		};
		var uploadNewContent = function (options) {
			return prepareContentAndFolderId(options)
				.then(function (options) {
					var formData = new FormData();
					formData.append("data", new Blob([JSON.stringify({
						"name": options.fileName,
						"parents": [options.folderId]
					})], { "type": "application/json" }));
					if (!Util.isString(options.content) && !Util.isFile(options.content)) {
						options.content = JSON.stringify(options.content);
					}
					formData.append("file", options.content);
					return doPostWithAuthPromise("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", formData);
				});
		};
		var getFileToOverWrite = function (options) {
			if (options.overwrite) {
				return me.getFile(options)
					.catch(function () {
						return Promise.resolve();
					});
			}
			else {
				return Promise.resolve();
			}
		};
		me.uploadContent = function (options) {
			return getFileToOverWrite(options)
				.then(function (existingFile) {
					if (existingFile) {
						options.fileId = existingFile.id;
						return overwriteContent(options);
					}
					else {
						return uploadNewContent(options);
					}
				});
		};
		me.getContentCache = function (options) {
			var fileName = options.fileName;
			var localFile = localStorage[fileName];
			if (localFile) {
				return JSON.parse(localFile);
			}
			return null;
		};
		var downloadFileContent = function (file) {
			if (!file) {
				return Util.errorPromise("No file to download");
			}
			if (!file.id) {
				return Util.errorPromise("No file id to download");
			}
			var downloadUrl = "https://www.googleapis.com/drive/v3/files/" + file.id + "?alt=media";
			return doGetWithAuthPromise(downloadUrl)
				.then(function (content) {
					content.fileId = file.id;
					return content;
				});
		};
		var setContentCache = function (fileName, content) {
			var contentToStore = content;
			if (!Util.isString(content)) {
				contentToStore = JSON.stringify(content);
			}
			localStorage[fileName] = contentToStore;
			return contentToStore;
		};
		me.downloadContent = function (options) {
			return me.getFile(options)
				.then(downloadFileContent)
				.then(function (content) {
					setContentCache(options.fileName, content);
					return content;
				});
		};
		var getDevicePushFileName = function (deviceId) {
			return "pushes=:=" + deviceId;
		};
		var getDeviceContactsFileName = function (deviceId) {
			return "contacts=:=" + deviceId;
		};
		var getFileParents = function (fileId) {
			if (!fileId) {
				return Util.errorPromise("No file Id to look for parents");
			}
			return doGetWithAuthPromise("https://www.googleapis.com/drive/v3/files/" + fileId + "?fields=parents");
		};
		var getDeviceFile = function (fileName, forceDownload) {
			var options = { fileName: fileName, getParents: true };
			return Promise.resolve()
				.then(function () {
					if (!forceDownload) {
						return me.getContentCache(options);
					}
				})
				.then(function (device) {
					if (device) {
						return device;
					}
					else {
						return me.downloadContent(options);
					}
				})
				.then(function (device) {
					device.folderId = options.folderId;
					return device;
				});
		};
		me.getDevicePushes = function (deviceId, forceDownload) {
			return getDeviceFile(getDevicePushFileName(deviceId), forceDownload);
		};
		me.getDeviceContacts = function (deviceId, forceDownload) {
			return getDeviceFile(getDeviceContactsFileName(deviceId), forceDownload);
		};
		me.getMyDevicePushes = function (forceDownload) {
			return me.getDevicePushes(localStorage.deviceId, forceDownload);
		};
		me.addPushToDevice = function (deviceId, push) {
			var fileName = getDevicePushFileName(deviceId);
			return me.getMyDevicePushes(false)
				.catch(function (error) {
					return {};
				}).then(function (device) {
					delete device.fileId;
					if (!device.pushes) {
						device.pushes = [];
					}
					push.date = new Date().getTime();
					device.pushes.push(push);
					var maxLength = 100;
					if (device.pushes.length > maxLength) {
						device.pushes.splice(0, device.pushes.length - maxLength);
					}
					return device;
				}).then(function (device) {
					setContentCache(fileName, device);
					return device;
				}).then(function (device) {
					return me.uploadContent({
						ignoreFolderForGetFile: true,
						//getParents:true,
						fileId: device.fileId,
						folderId: device.folderId,
						content: device,
						fileName: fileName,
						folderName: GoogleDrive.getBaseFolderForMyDevice() + "/Push History Files",
						overwrite: true
					});
				}).then(function (result) {
					console.log("Uploaded push history");
					console.log(result);
				}).catch(function (error) {
					console.error("Couldn't upload push history");
					console.error(error.stack);
				});
		};
		me.addPushToMyDevice = function (push) {
			me.addPushToDevice(localStorage.deviceId, push);
		};
	}
	static getBaseFolderForMyDevice() {
		var deviceName = localStorage.deviceName;
		if (!deviceName) {
			deviceName = "Chrome";
		}
		return GoogleDrive.getBaseFolder() + "/from " + deviceName;
	}
	static getBaseFolder() {
		return "Join Files";
	}
	static async convertFilesToGoogleDriveIfNeeded({files, downloadToBase64IfNeeded, authToken}){
		if(!files) return files;

		const convert = async file=>{
			var fileId = GoogleDrive.getFileIdFromUrl(file);
			if(!fileId && file.indexOf("http")<0){
				if(file.length > 50){
					file = Util.getBase64ImageUrl(file);
					return file;
				}
				fileId = file;
			}
			if(fileId){
				if(downloadToBase64IfNeeded){
					file = GoogleDrive.getDownloadUrlFromFileId(fileId);
				}else{
					file = `https://drive.google.com/uc?export=download&id=${fileId}`;
				}
			}else{
				downloadToBase64IfNeeded = false;
			}
			if(downloadToBase64IfNeeded){
				file = await Util.getImageAsBase64(file,authToken);
			}
			return file;
		}
		if(files.map){
			for (let index = 0; index < files.length; index++) {
				files[index] = await convert(files[index]);				
			}
			return files;
		}else{
			return await convert(files);
		}
	}
	static getFileIdFromUrl(fileUrl) {
		if (fileUrl.indexOf("drive.google.com/file/d") < 0 && fileUrl.indexOf("https://www.googleapis.com/drive/v2/files/") < 0) {
			return null;
		}
		var match = fileUrl.match(/[^/\\.\\?&=]{20,}/);
		if (!match || match.length == 0) {
			return null;
		}
		return match[0];
	}
	static getDownloadUrlFromFileId(fileId) {
		if (!fileId) {
			return null;
		}
		if (fileId.indexOf("http") >= 0) {
			fileId = GoogleDrive.getFileIdFromUrl(fileId);
		}
		if (fileId.indexOf(".") >= 0) {
			return fileId;
		}
		return GoogleDrive.baseDriveUrlFiles + fileId + "?alt=media";
	}
	static getDownloadUrlFromFileName(fileName) {
		if (!fileName) {
			return null;
		}
		console.log("Getting download url for " + fileName);
		return new GoogleDrive()
			.getFile({ "fileName": fileName })
			.then(file => GoogleDrive.getDownloadUrlFromFileId(file.id))
			.catch(error => console.log("Couldn't get download url for file name " + fileName));
	}
	static get baseDriveUrlFiles(){
		return "https://www.googleapis.com/drive/v2/files/";
	}
	static isDriveUrl(url){
		return url.indexOf("drive.google") > 0 || url.indexOf("docs.google")>0 || url.indexOf("googleapis.com")>0 ;
	}
}

try{
	exports.GoogleDrive = GoogleDrive;
}catch{}