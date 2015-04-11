var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var _ = require('underscore')._;
var handlebars = require('handlebars');
var naturalSort = require('javascript-natural-sort');
var Convert = require('ansi-to-html');
var convert = new Convert();

var pathToReports = './reports';
var publicHTML = './public';

handlebars.registerHelper('equal', function(lvalue, rvalue, options) {
  if (arguments.length < 3)
  throw new Error("Handlebars Helper equal needs 2 parameters");
if( lvalue!=rvalue ) {
  return options.inverse(this);
} else {
  return options.fn(this);
}
});

handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

handlebars.registerHelper('escape_dots', function(context) {
  return context.replace(/\./g, "\\.");
});

handlebars.registerHelper('tooltip', function(context) {
  if (context) { return context.replace(/\//g, "/\u200d") }
});

handlebars.registerHelper('ansi', function(context) {
  if (context) { return convert.toHtml(context); }
});

_.mixin({

  sortByNat: function(obj, value, context) {
    var iterator = _.isFunction(value) ? value : function(obj){ return obj[value]; };
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
           index: index,
           criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      return naturalSort(a, b);
    }), 'value');
  }
});

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

  var sources = input.sources;
  var input = input.tests;

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
    var matches = e.file_path.match(/^\.\/spec\/([^\/]+)\/([^\/]+)\/([^\/]+)_spec\.rb$/);
    if (matches) {
      return [ matches[2], matches[3], e.line_number, e.full_description, matches[1] ];
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

    function extractSources(result, sources) {
      // Extract the appropriate source snippet.
      var file = result.file_path;
      var start = result.line_number;
      var end = result.line_number;
      var source = sources[file];
      // We search for the first blank lines followed by a non-idented line
      while (start > 1 &&
          (source[start - 1] !== "" ||
           (source[start] || "").match(/^\s/) !== null)) start--;
      while (source[end - 1] !== undefined &&
          (source[end - 1] !== "" ||
           (source[end - 2] || "").match(/^\s/) !== null)) end++;
      start++; end--;
      return {
        "start": start,
        "snippet": source.slice(start - 1, end).join("\n")}
    };
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
    var specs2show = [];
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
              bfail = failure;
              failure += _.reduce(res,
                function (memo, r) {
                  return memo + ((r.status === "failed")?1:0);
                }, 0);
              if (bfail != failure) { specs2show.push(spec) };
              success += _.reduce(res,
                function (memo, r) {
                  return memo + ((r.status === "passed")?1:0);
                }, 0);
              //only failures
              //res = _.filter(res, function(r){ return r.status == "failed"; });
              return _.map(res, function(r) {
                var source = "";
                if (r.status == "failed") { source = extractSources(r, sources) }
                return {
                  "role": role,
                     "spec": spec,
                     "test": r,
                     "source": source
                };
              })
            });
        });
    return { "name": h.hostname,
      "success": success,
      "failure": failure,
      "color": successColor(success, failure),
      "results": _.flatten(rr) };
    });

    specs = _.filter(specs, function(spec) { return _.contains(specs2show, spec.name) });

    _.each(results, function(host_result){
      host_result.results = _.filter(host_result.results, function(r){
        return _.contains(specs2show, r.spec);
      });
    });

    results = _.sortByNat(results, function(host_result) {return host_result.name});

    var success = _.reduce(results, function(memo, r) { return memo + r.success }, 0);
    var failure = _.reduce(results, function(memo, r) { return memo + r.failure }, 0);
    var percent = success + failure;
    percent = percent?(Math.floor(success * 100 / percent)):null;
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
  if(/.+\.json$/.test(incoming.pathname)) {
    function recurse() {
      fs.readFile(pathToReports + incoming.pathname + '.parsed', function(err,data){
        if (err) {console.log(err);
          var data = fs.readFile(pathToReports + incoming.pathname, function(err,data){
            if (err) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Report not found');
              return }
            data = JSON.parse(data);
            data.tests = formatResults(data);
            fs.writeFileSync(pathToReports + incoming.pathname + '.parsed',
              JSON.stringify(data));
            console.log('Reformatting json...');
            recurse();
          });
        } else {
          data = JSON.parse(data);
          fs.readFile(__dirname + '/report.handlebars', function(err,html){
            var template = handlebars.compile(html.toString());
            var rendered = template(data);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(rendered);
          });
        }
      });
    };
    recurse();
  } else if(incoming.pathname == '/'){
    fs.readFile(__dirname + '/index.handlebars', function(err,html){
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.exists(pathToReports, function(exists) {
        if (exists) {
          fs.readdir(pathToReports, function(err, files){
            var data = {};
            data.files = [];
            files.forEach(function(name){
              if(path.extname(name) == '.json'){
                data.files.push(name);
              }
            });
            if ( data.files.length > 0 ) {
              data.files = data.files.sort(function(a,b){
                return fs.statSync(pathToReports + '/' + b).mtime.getTime() -
                       fs.statSync(pathToReports + '/' + a).mtime.getTime();
                });
              var template = handlebars.compile(html.toString());
              var rendered = template(data);
              res.end(rendered);
            } else {
              res.end("There are no reports around yet...");
            }
          });
        } else {
          res.end("There are no reports around yet...");
        }
      });
    });
  } else if(/(\.js$|\.css$|\.html$)/.test(incoming.pathname)){
    serveStatic(publicHTML + incoming.pathname, res);
  } else {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end();
  }
});

server.listen(process.env.PORT || 3000, process.env.LISTEN || '127.0.0.1');
