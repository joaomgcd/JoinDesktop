var GcmMultiMap = function(){
	this.add = function(id,index,value,type,length){
		var gcmMessages = this[id];
		if(!gcmMessages){
			gcmMessages = new GcmMultis();
		}
		gcmMessages.push({"index":index,"type":type,"value":value,"length":length});
		this[id] = gcmMessages;
		return gcmMessages;
	}
}
var GcmMultis = function(){
	this.getComplete = function(){
		var length = null;
		var type = null;
		for(var i = 0;i<this.length;i++){
			var gcmMulti = this[i];
			if(gcmMulti.length){
				length = gcmMulti.length;
				type = gcmMulti.type;
				break;
			}
		}
		if(!length){
			return;
		}
		if(this.length < length){
			return;
		}
		if(!type){
			return;
		}
		this.sort(function(left, right){
			return left.index - right.index;
		});
		var finalGcm = "";
		for(var i = 0;i<this.length;i++){
			var gcmMulti = this[i];
			finalGcm += gcmMulti.value;
		}
		//console.log(finalGcm);
		return {"json": finalGcm, "type": type};
	}
}
GcmMultis.prototype = new Array();
var gcmMultiMap = new GcmMultiMap();
