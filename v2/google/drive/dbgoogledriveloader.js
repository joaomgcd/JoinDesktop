import { EventBus } from "../../eventbus.js";

export class DBGoogleDriveLoader{
    //abstract
    async getDbSpecific(db){}
    //abstract
    async loadFromGoogleDrive(args){}
    //abstract
    async requestFromGoogleDrive(args){}
    //abstract
    async loadFromLocalNetwork(args){}
    
    get requestNewestVersionInsteadOfLoadingFromGoogleDrive(){
        return false;
    }   
    get alwaysRequestFromGoogleDrive(){
        return false;
    }
	async reportStatus(message){
		await EventBus.post(new StatusReport(message));
	}

    async load({db,refresh,dbGoogleDriveArgs}){
        /** @type {Device} */
        const device = dbGoogleDriveArgs.device;
        const dbItems = await this.getDbSpecific(db);
        let stillLoading = false;
        const updateFromNetwork = async ()=>{            
            var items = null;
            try{
                const canGetFromLocal = device.canContactViaLocalNetwork && !this.alwaysRequestFromGoogleDrive;
                if(canGetFromLocal){
                    await this.reportStatus(`Loading from local network for ${device.deviceName}...`);
                }
                items =  canGetFromLocal ? await this.loadFromLocalNetwork(dbGoogleDriveArgs) : null;
            }catch(error){
                console.log("Couldn't load from local network",device,error)
                await device.setToRemoteNetwork(true);
                //not available through local network. Let's try google drive
            }
            if(!items){
                if(this.requestNewestVersionInsteadOfLoadingFromGoogleDrive){
                    await this.reportStatus(`Requesting remotely for ${device.deviceName}...`);
                    await this.requestFromGoogleDrive(dbGoogleDriveArgs);
                    stillLoading = true;
                }else{
                    await this.reportStatus(`Loading from Google Drive for ${device.deviceName}...`);
                    items = await this.loadFromGoogleDrive(dbGoogleDriveArgs);                        
                }
            }
            if(dbItems && items){
                dbItems.updateAll(dbGoogleDriveArgs.deviceId,items);
            }
            return await Encryption.decrypt(items);
        }
        try{
            if(!dbItems || refresh){
                return await updateFromNetwork();
            }
            var items = await dbItems.getAll(dbGoogleDriveArgs);
            if(items && items.length > 0) return items;

            return await updateFromNetwork();

        }finally{    
            if(!stillLoading){     
                await this.reportStatus(null);
            }   
        }
    }

}
class StatusReport{
	constructor(message){
		this.message = message;
	}
}