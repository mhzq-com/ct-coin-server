var Service;

switch(process.platform){
  case "aix":
    break;
  case "android":
    break;
  case "cygwin":
    break;
  case "darwin":
    require('node-mac').Service;
    break;
  case "freebsd":
    break;
  case "linux":
    Service = require('node-linux').Service;
    break;
  case "netbsd":
    break;
  case "openbsd":
    break;
  case "sunos":
    break;
  case "win32":
    Service = require('node-windows').Service;
    break;
}


// Create a new service object
var svc = new Service({
  name:'ctsocketserver',
  description: 'CityMedia socket server service',
  script: __dirname + '/app.js',
  nodeOptions: [
  ]
  //, workingDirectory: '...'
});


// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.on("alreadyuninstalled", function(){
    svc.install();
});

svc.on("doesnotexist", function(e){
	svc.install();
});

svc.on("uninstall", function(){
	svc.install();
});

svc.on("error", function (error){
  console.log(error);
  //svc.install();
});

try {
	svc.uninstall();
} catch (error) {

}
