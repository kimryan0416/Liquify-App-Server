function httpRequester(type,url,contenttype,content,next) {
	var xhr = new XMLHttpRequest();
	xhr.open(type, url);
	if (type.toLowerCase() == "post") {
		var cType = (contenttype != null) ? contenttype : 'application/json';
		xhr.setRequestHeader('Content-Type',cType);
	}
	xhr.onload = function() {	next(xhr);	}
	xhr.send(content);
}

function qs(key) {
    key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
    var match = location.search.match(new RegExp("[?&]"+key+"=([^&]+)(&|$)"));
    return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}

function initializeLiquify(clientName = 'Liquify Sandbox',env,products,public_key,countryCodes) {
	console.log(clientName);
	var handler = Plaid.create({
		apiVersion: 'v2',
		clientName: clientName,
		env: env,
		product: products,
		key: public_key,
		countryCodes: countryCodes,
		// webhook: 'https://your-domain.tld/plaid-webhook',
		onSuccess: function(public_token) {
			console.log(public_token);
			alert(public_token);
			httpRequester('post','/get_access_token','application/json',JSON.stringify({public_token: public_token}),(data)=>{
				console.log(data);
			});
		}
	});
	handler.open();
}