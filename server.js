var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var _ = require('underscore')._;

var pathToReports = './reports';
var publicHTML = './viewer';

function serveStatic(file, res){
    fs.readFile(file, function(err, data){
      if (err) throw err;
      var mimeType = 'text/html';
      if(/\.js$/.test(file)){
        mimeType = 'application/javascript'
      } else if (/\.css$/.test(file)){
        mimeType = 'text/css'
      };
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
};

// Format results to display them more effectively
var formatResults = function(input) {

    console.log("Formatting results");

    // Input is something like that:
    // [{ "hostname": "....",
    //    "results": { "examples": [
    //          { "description": "should ...",
    //            "file_path": "./spec/role/something_spec.rb",
    //            "full_description": "Squid should ...",
    //            "line_number": 4,
    //            "status": "passed" },
    //          { ... } ] } },
    //  { ... }]

    // We want to display something like this:
    //
    //           |  all   |  web   |
    //  ------------------------------------
    //    web1   | ✓ ✗ ✓  | ✓ ✓ ✓  |
    //    web2   | ✓ ✗ ✓  | ✓ ✓ ✓  |
    //    web3   | ✓ ✗    | ✓ ✓ ✓  |
    //  ------------------------------------
    //           |  all   |  memcache   |
    //  ------------------------------------
    //    memc1  | ✓ ✓ ✓  | ✓ ✓ ✓ ✓ ✓ ✓ |
    //    memc2  | ✓ ✓ ✓  | ✓     ✓     |
    //    memc3  | ✓ ✓ ✓  | ✓ ✓ ✓ ✓     |
    //  ------------------------------------
    //           |
    //  ------------------------------------
    //    unkn1  |
    //    unkn2  |

    // So, we need to extract:
    //
    //   1. The set of roles. In the example above, this is
    //      (all, web), (all, memcache) and ().
    //
    //   2. For each set, get the list of hosts in the set. We should
    //      be able to attach the number of succesfull/failed tests to
    //      be able to display them as overlay or as a background
    //      color.
    //
    //   3. For each role in each set, we should be able to have the
    //      number of tests to be displayed.
    //
    //   4. For each host, for each role, for each spec file in the
    //      role (even those not executed for this specific host), for
    //      test in spec file (even those not executed), we need to
    //      know the status, the description. The order should be the
    //      same for each host, including the tests not run. We need
    //      to ensure that a given column for a role set is always the
    //      same test.
    //
    // In output, we get (this is a flattened output to allow easy
    // iteration in AngularJS):
    //
    // [ { "roles": [ {name: "all", tests: 5 },
    //                {name: "web", tests: 10 } ],
    //     "specs": [ {role: "all", name: "lldpd", tests: 5},
    //                {role: "web", name: "apache2", tests: 10 }],
    //     "results": [ {name: "web1", success: 14, failure: 1,
    //                   results: [{role: "all",
    //                              spec: "lldpd",
    //                              test: {status: "failed",
    //                                     line_number: 4,
    //                                     full_description: "...",
    //                                     exception: {...}}]

    var output = [];

    // Get example identifier (role, spec, line number)
    var exampleIdentifier = function (e) {
        var matches = e.file_path.match(/^\.\/spec\/([^\/]+)\/([^\/]+)_spec\.rb$/);
        if (matches) {
            return [ matches[1], matches[2], e.line_number, e.full_description ];
        }
    };

    // Get role attached to an example
    var exampleRole = function (e) {
        var id = exampleIdentifier(e);
        if (id) {
            return id[0];
        }
    };

    // Get roles attached to a result
    var resultRoles = function(r) {
        return _.uniq(_.map(r.results.examples, exampleRole),
                      function(x) { return JSON.stringify(x); });
    };

    // Display string for a role set
    var roleSetName = function(rs) {
        return rs.join(", ");
    };

    // Affect a color depending on the number of success and failures
    var successColor = function(success, failure) {
        if (success + failure === 0) {
            return "black";
        }
        var percent = success / (success + failure*5); // failures are more important
        // #32cd32
        var color1 = [ 0x32, 0xcd, 0x32 ];
        // #ff6347
        var color2 = [ 0xff, 0x63, 0x47 ];
        var target = _.zip(_.map(color1, function(x) { return x*percent }),
                           _.map(color2, function(x) { return x*(1-percent) }));
        target = _.map(target, function(x) {
            var r = x[0] + x[1];
            var s = Math.round(r).toString(16);
            return s.length == 2 ? s : '0' + s;
        });
        return "#" + target.join("");
    };

    // Provides result for a given test
    var testResult = function(examples, test) {
        var ts = JSON.stringify(test);
        var example = _.find(examples, function(e) {
            return JSON.stringify(exampleIdentifier(e)) === ts;
        });
        if (!example) return { "status": "missing" };
        return example;
    };

    // Set of roles.
    var roleSets = _.sortBy(
        _.uniq(_.map(input, resultRoles),
               function(x) { return JSON.stringify(x); }),
        function(a) { return -a.length });
    console.log(roleSets.length + " role sets");
    _.each(roleSets, function (rs) {
        rs.name = roleSetName(rs) || "<none>";
        console.log("(" + rs.name + ")");
    });

    _.each(roleSets, function(rs) {
        console.log("Process role set (" + rs.name + ")");

        // We need to get a list of all tests in a topological order
        // for the current roleset. A test is a role, a spec file and
        // a line number.
        var tests = _.map(input, function(r) {
            // Keep only examples that match our roleset
            var examples = _.filter(r.results.examples, function(e) {
                return _.indexOf(rs, exampleRole(e)) != -1
            });
            return _.map(examples, exampleIdentifier);
        });

        // Our topological sort can be done with a simple sort as we
        // have everything we need.
        tests = _.flatten(tests, true);
        tests = _.uniq(tests, function(x) { return JSON.stringify(x); });
        tests = _.filter(tests, function(t) { return t.length > 0; });
        tests.sort(function(t1, t2) {
            if (t1[0] < t2[0]) return -1;
            if (t1[0] > t2[0]) return 1;
            if (t1[1] < t2[1]) return -1;
            if (t1[1] > t2[1]) return 1;
            if (t1[2] < t2[2]) return -1;
            if (t1[2] > t2[2]) return 1;
            return 0;
        });

        console.log("Tests are: ", _.map(tests, function(t) {
            return t.join(":");
        }));

        // List of roles with the number of tests
        var roles = _.map(_.groupBy(tests, function(t) { return t[0]; }),
                          function (tests, role) {
                              return { "name": role,
                                       "tests": tests.length,
                                       "specs":  _.map(_.groupBy(tests, function(t) { return t[1]; }),
                                                       function (tests, spec) {
                                                           return { "name": spec,
                                                                    "tests": tests.length };
                                                       })};
                          });
        var specs = _.flatten(_.map(roles, function(role) {
            var sp = role.specs;
            delete role.specs;
            _.map(sp, function(s) { s.role = role.name; });
            return sp;
        }), true);

        // Results for each host (not very efficient)
        var results = _.filter(input, function(h) {
            return JSON.stringify(resultRoles(h)) === JSON.stringify(rs)
        });
        results = _.map(results, function(h) {
            var success = 0;
            var failure = 0;
            var rr = _.map(_.groupBy(tests, function(t) { return t[0]; }),
                           function (tests, role) {
                               return _.map(_.groupBy(tests, function(t) { return t[1]; }),
                                            function(tests, spec) {
                                                var res = _.map(tests, function (t) {
                                                    return testResult(h.results.examples, t);
                                                });
                                                failure += _.reduce(res,
                                                                    function (memo, r) {
                                                                        return memo + ((r.status === "failed")?1:0);
                                                                    }, 0);
                                                success += _.reduce(res,
                                                                    function (memo, r) {
                                                                        return memo + ((r.status === "passed")?1:0);
                                                                    }, 0);
                                                //only failures
                                                //res = _.filter(res, function(r){ return r.status == "failed"; });
                                                return _.map(res, function(r) {
                                                    return {
                                                        "role": role,
                                                        "spec": spec,
                                                        "test": r
                                                    };
                                                })
                                            });
                           });
            return { "name": h.hostname.split(".").slice(0,3).join("."),
                     "success": success,
                     "failure": failure,
                     "color": successColor(success, failure),
                     "results": _.flatten(rr) };
        });

        var success = _.reduce(results, function(memo, r) { return memo + r.success }, 0);
        var failure = _.reduce(results, function(memo, r) { return memo + r.failure }, 0);
        var percent = success + failure;
        percent = percent?(Math.round(success * 100 / percent)):null;
        output.push({"name": rs.name,
                     "roles": roles,
                     "percent": percent,
                     "success": success,
                     "failure": failure,
                     "specs": specs,
                     "results": results,
                     "tests": tests.length});
    });

    return output;
}


var server = http.createServer(function(req,res){
   res.writeHead(200, { 'Content-Type': 'application/json' });
   var incoming = url.parse(req.url, true);
   if(incoming.pathname == '/reports'){
     fs.readdir(pathToReports, function(err, files){
       var filteredFiles = [];
       files.forEach(function(name){
         if(path.extname(name) == '.json'){
           filteredFiles.push(name);
         }
       }); 
     res.end(JSON.stringify(filteredFiles))});
   } else if(/.+\.json$/.test(incoming.pathname)) {
     fs.readFile(pathToReports + incoming.pathname, function(err,data){
       if (err) throw err;
       data = JSON.parse(data);
       data.tests = formatResults(data.tests);
       res.end(JSON.stringify(data));       
     });
   } else if(incoming.pathname == '/'){
     serveStatic(publicHTML + '/index.html', res);
   } else if(/(\.js$|\.css$|\.html$)/.test(incoming.pathname)){
     serveStatic(publicHTML + incoming.pathname, res);
   } else {
     res.writeHead(400, { 'Content-Type': 'application/json' });
     res.end();
   }
});

server.listen(process.argv[2]);
