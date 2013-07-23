/// <reference path="../defs/grunt.d.ts"/>

/*
 * grunt-ts
 * Licensed under the MIT license.
 */


declare var require;
declare var __dirname;
declare var mapObj;
declare var key;

interface ICompileResult {
    code: number;
    output: string;
}

interface IOptions {
    src: string[]; // input files 
    reference: string; // path to a reference.ts e.g. './approot/'
    out: string; // if sepecified e.g. 'single.js' all output js files are merged into single.js using tsc --out command 
    watch: string; // if specified e.g. './appdir/' will watch the directory for changes. Note that specifing this makes the grunt task async (i.e. it keep running)


    target: string; // es3 , es5 
    module: string; // amd, commonjs 
    sourcemap: boolean;
    declaration: boolean;
    verbose: boolean;
}

module.exports = function (grunt: IGrunt) {

    var path = require('path'),
        fs = require('fs'),
        vm = require('vm'),
        shell = require('shelljs');
    var eol = require('os').EOL;

    function resolveTypeScriptBinPath(currentPath, depth): string {
        var targetPath = path.resolve(__dirname,
            (new Array(depth + 1)).join("../../"),
            "../node_modules/typescript/bin");
        if (path.resolve(currentPath, "node_modules/typescript/bin").length > targetPath.length) {
            return;
        }
        if (fs.existsSync(path.resolve(targetPath, "typescript.js"))) {
            return targetPath;
        }

        return resolveTypeScriptBinPath(currentPath, ++depth);
    }

    function getTsc(binPath: string): string {
        return '"' + binPath + '/' + 'tsc" ';
    }

    function compileAllFiles(filepaths: string[], options: IOptions, task): ICompileResult {

        var filepath: string = filepaths.join(' ');
        var cmd = 'node ' + tsc + ' ' + filepath;
        // TODO: use options 
        if (options.out) {
            cmd = cmd + ' --out ' + options.out;
        }
        var result = exec(cmd);
        return result;
    }

    function endWithSlash(path: string): string {
        var lastchar = path[path.length - 1];
        if (lastchar != '/' && lastchar != '\\') {            
            return path + '/';
        }
        return path;
    }

    var exec = shell.exec;
    var currentPath = path.resolve(".");
    var tsc = getTsc(resolveTypeScriptBinPath(currentPath, 0));

    grunt.registerMultiTask('ts', 'Compile TypeScript files', function () {

        var currenttask = this;

        // Was the whole process successful
        var success = true;
        var watch;

        this.files.forEach(function (f: IOptions) {
            var files: string[] = f.src;


            // If you want to ignore .d.ts
            //files = []
            //grunt.file.expand(f.src).forEach(function (filepath) {
            //    if (filepath.substr(-5) === ".d.ts") {
            //        return;
            //    }
            //    files.push(filepath);
            //});

            // Create a reference file 
            var reference = f.reference;
            if (!!reference) {
                reference = endWithSlash(reference);
                var contents = [];
                files.forEach((filename: string) => {
                    // do not add a reference to reference: 
                    if (filename.indexOf('reference.ts') == -1)
                        contents.push('/// <reference path="' + path.relative(reference, filename).split('\\').join('/') + '" />')
                });
                fs.writeFileSync(reference + '/reference.ts', contents.join(eol));
            }

            // Compiles all the files 
            function runCompilation(files) {
                var result = compileAllFiles(files, f, currenttask);
                if (result.code != 0) {
                    var msg = "Compilation failed"/*+result.output*/;
                    grunt.log.error(msg.red);
                    success = false;
                }
                else {
                    grunt.log.writeln((files.length + ' typescript files successfully processed.').green);
                }
            }
            runCompilation(files);

            // Watches all the files 
            watch = f.watch;
            if (!!watch) {
                var watch = endWithSlash(watch);
                var done = currenttask.async();
                var Gaze = require('gaze').Gaze;
                var watchpath = watch + '**/*.ts';
                var gaze = new Gaze(watchpath);
                grunt.log.writeln(('Watching all files: ' + watchpath).cyan);
                // A file has been added/changed/deleted has occurred
                gaze.on('all', function (event, filepath) {
                    grunt.log.writeln(('    >>' + filepath + ' was ' + event).yellow);
                    grunt.log.writeln('Compiling.'.yellow);
                    //runCompilation([filepath]); // Potential optimization, But we want the whole project to be compilable
                    runCompilation(files);
                });               
            }

        });

        if (!watch)
            return success;
    });
};
