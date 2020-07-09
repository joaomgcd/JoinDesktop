export class FileUploadProviderFactory{
    static create(options = {devicesToSendTo}){
        const canAllSend = options.devicesToSendTo.every(device=>device.canContactViaLocalNetwork);
        const uploaders = [];
        if(canAllSend){
            uploaders.push(new FileUploadProviderLocalNetwork(options));
        }
        uploaders.push(new FileUploadProviderGoogleDrive(options));
        return uploaders;
    }
    async provide({files,device}){
        const fileUploaders = FileUploadProviderFactory.create({"files":files,"deviceIdsToSendTo":[deviceId]});
        var count = 0;
        for(const fileUploader of fileUploaders){
            count++;
            try{
                const uploadResults = await fileUploader.provide();
                return uploadResults[0].files;
            }catch(e){
                if(count == fileUploaders.length){
                    throw e;
                }
            }
        }
    }
}
const FileUploadProviderLocalNetwork = function({files,deviceIdsToSendTo}){
    
    const uploadFile = async (file,serverAddress) => {
        const options = {
            method: 'POST',
            body: file,
            headers: {
                "Content-Disposition": `filename="${file.name}"`
              }
        }
        const url = `${serverAddress}files?token=${await back.getAuthTokenPromise()}`; 
        console.log(`Uploading ${file.name} to ${serverAddress}...`);
        const result = await fetch(url,options);
        return result.json();
    }
    //returns final file URL and deviceIds
    this.provide = async ()=>{        
        const result = deviceIdsToSendTo.map(async deviceId=>{
            try{
                const serverAddress = UtilsDevices.getLocalNetworkServerAddress(deviceId);
                const uploads = Array.from(files).map(file=>uploadFile(file,serverAddress));
                const results = (await Promise.all(uploads));
                
                const resultFiles = results.map(result=>{
                    if(!result.success) throw result.errorMessage;

                    return result.payload[0].path;
                });
                return {"deviceId":deviceId,"files":resultFiles}; 
            }catch(e){            
                UtilsDevices.setCanContactViaLocalNetwork(deviceId,false);
                throw e;
            }
        });
        return await Promise.all(result);
       
    }
}


const FileUploadProviderGoogleDrive = function({files,deviceIdsToSendTo}){
    this.provide = async ()=>{          
        const result = deviceIdsToSendTo.map(async deviceId=>{
            var googleDriveManager = new GoogleDriveManager();    
            var filesToUpload = files;
            var device = devices.first(function(device){return device.deviceId == deviceId});
            var accountToShareTo = null;
            if(device){
                accountToShareTo = device.userAccount;
            }
            const result = await googleDriveManager.uploadFiles({
                folderName: GoogleDriveManager.getBaseFolderForMyDevice(),
                accountToShareTo:accountToShareTo,
                notify: back.getShowInfoNotifications()
            }, filesToUpload);
            return {"deviceId":deviceId,"files":result};
        });
        return Promise.all(result);
    }
}