/*
 * @title   CI Script for S3 Uploads
 * @author  lstanek4@gmail.com
 * version: 1
 */

/* ---------------------------
Env Options - Require Setup
--------------------------- */
// define dev and prod buckets we can deploy to:
const _buckets = {
    prod: 'some-url.com',
    dev: 'some-url-uat.com'
}
const _s3DestDir = 'insert-directory-name/'; // S3 directory to deploy to - root would be ''
const _sourceDir = 'insert-directory-name/'; // local build directory - usually 'dist/'

// files to exclude from deployment
const _excludeFiles = [
    'node_modules/*',
    'node_modules/.bin/*',
    'bower_components/*',
    '*.yml',
    'AwsConfig.json',
    's3_deploy.js',
    '.git/*',
    '.DS_Store',
    '.gitignore',
    'README.md',
    'notes.txt'
]

// aws connection auth setup
const _accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const _secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

/* ---------------------------
Define Env Params
--------------------------- */
var _bucket = false;
var subdirDeploymentDefined = (_s3DestDir === '' ? false : true);
process.argv.forEach(function (val, index, array) {
    if (val === 'deploy-prod') {
        _bucket = _buckets.prod;
    }
    if (val === 'deploy-dev') {
        _bucket = _buckets.dev;
    }
});
if (!_bucket) {
    console.log('No bucket is defined');
    return false;
} else {
    if (subdirDeploymentDefined) {console.log('****** SUBDIRECTORY DEFINED: '+ _s3DestDir +' (likely going to skip files during deletion) ******')}
    console.log('****** DEPLOYING TO ' + _bucket + ' ******');
}


/* ---------------------------
include required libraries
--------------------------- */
var fs = require('fs');
var recursive = require('recursive-readdir');
var aws = require('aws-sdk');
var q = require('q');

/* ---------------------------
init
--------------------------- */
// auth for s3
aws.config = {
    "accessKeyId": _accessKeyId,
    "secretAccessKey": _secretAccessKey,
    "signatureVersion": 'v4',
    "region": "us-east-1" // May need adjusted
};
var s3 = new aws.S3();

// once we get the files, continue
getFilesASync().then(function (filesFound)
{
    // first wipe out the current S3 Bucket directory
    emptyBucket(_bucket, function ()
    {
        // loop over every file and upload it (cloudfront should give us enough time to do this)
        filesFound.forEach(function (entry)
        {
            var targetEntry = entry.replace(_sourceDir, _s3DestDir);
            uploadFile((targetEntry), ('./' + entry));
        });

    });
})
// we had some sort of issue getting the files - kill the script.
.catch(function (error) {
    console.error(error);
    return false;
});



/* ---------------------------
FUNCTIONS
--------------------------- */
/**
 * get files to upload - this is aSync so we need to wait for the response
 */
function getFilesASync() {
    var deferred = q.defer();
    // loop over the files, exclude a few of them
    recursive('./'+_sourceDir, _excludeFiles, function (err, files) {
        console.log(files.length + ' files found.');
        if (err) {
            return deferred.reject('Error! - ' + err);
        } else if (files.length < 1) {
            return deferred.reject('Error! - No files found');
        } else {
            return deferred.resolve(files);
        }
    });
    return deferred.promise;
}

/**
 * upload single file function
 * @param {string} remoteFilename
 * @param {string} fileName
 */
function uploadFile(remoteFilename, fileName) {
    var fileBuffer = fs.readFileSync(fileName);
    var metaData = getContentTypeByFile(fileName);

    console.log(fileName + ' -> uploading...');
    s3.putObject({
        ACL: 'public-read',
        Bucket: _bucket,
        Key: remoteFilename,
        Body: fileBuffer,
        ContentType: metaData
    }, function (error, response) {
        if (arguments[0])
        {
            console.log(remoteFilename + ' -> ' + arguments[0].message);
        } else
        {
            console.log(remoteFilename + ' -> OK!');
        }

    });
}

/**
 * sets meta data for file upload
 * @param {string} fileName
 */
function getContentTypeByFile(fileName) {
    var rc = 'application/octet-stream';
    var fileNameLowerCase = fileName.toLowerCase();
    if (fileNameLowerCase.indexOf('.html') >= 0) rc = 'text/html';
    else if (fileNameLowerCase.indexOf('.css') >= 0) rc = 'text/css';
    else if (fileNameLowerCase.indexOf('.json') >= 0) rc = 'application/json';
    else if (fileNameLowerCase.indexOf('.js') >= 0) rc = 'application/x-javascript';
    else if (fileNameLowerCase.indexOf('.png') >= 0) rc = 'image/png';
    else if (fileNameLowerCase.indexOf('.jpg') >= 0) rc = 'image/jpg';
    return rc;
}

/**
 * emptyBucket
 * @param {string} bucketName
 * @param {function} callback
 */
function emptyBucket(bucketName, callback) {
    s3.listObjects({Bucket: bucketName}, function (err, data)
    {
        if (err) return callback(err);
        if (data.Contents.length == 0) callback();
        params = {
            Bucket: bucketName ,
            Delete: {
                Objects: []
            }
        };
        data.Contents.forEach(function (content) {
            if (!subdirDeploymentDefined || content.Key.indexOf(_s3DestDir) > -1) {
                params.Delete.Objects.push({ Key: content.Key });
            } else {
                console.log(content.Key + ' *** SKIPPING ** not in "' + _s3DestDir);
            }
        });
        s3.deleteObjects(params, function (err, deleteData) {
            if (err) return callback(err);
            if (deleteData.Contents)
            {
                if (deleteData.Contents.length == 1000) emptyBucket(bucketName, callback);
            }
            else callback();
        });
    });
}
