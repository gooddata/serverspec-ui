var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');

var pathToReports = './reports';

var server = http.createServer(function(req,res){
   res.writeHead(200, { 'Content-Type': 'application/json' });
   var incoming = url.parse(req.url, true);
   if(incoming.pathname == '/'){
     fs.readdir(pathToReports, function(err, files){
       var filteredFiles = [];
       files.forEach(function(name){
         if(path.extname(name) == '.json'){
           filteredFiles.push(name);
         }
       }); 
     res.end(JSON.stringify(filteredFiles))});
   } else if(/.+\.json/.test(incoming.pathname)) {
     fs.readFile(pathToReports + incoming.pathname, function(err,data){
       if (err) throw err;
       res.end(JSON.stringify(JSON.parse(data)));       
     });
   } else {
     res.writeHead(400, { 'Content-Type': 'application/json' });
     res.end();
   }
});

server.listen(process.argv[2]);
