/*
 * Copyright (c) 2014 Juniper Networks, Inc. All rights reserved.
 */
 
 /**
 * @quotasconfig.api.js
 *     - Handlers for project quotas
 *     - Interfaces with config api server
 */
var rest        = require(process.mainModule.exports["corePath"] +
                          '/src/serverroot/common/rest.api');
var async       = require('async');
var quotasconfigapi = module.exports;
var logutils    = require(process.mainModule.exports["corePath"] +
                          '/src/serverroot/utils/log.utils');
var commonUtils = require(process.mainModule.exports["corePath"] +
                          '/src/serverroot/utils/common.utils');
var config      = process.mainModule.exports["config"];
var messages    = require(process.mainModule.exports["corePath"] +
                          '/src/serverroot/common/messages');
var global      = require(process.mainModule.exports["corePath"] +
                          '/src/serverroot/common/global');
var appErrors   = require(process.mainModule.exports["corePath"] +
                          '/src/serverroot/errors/app.errors');
var util        = require('util');
var url         = require('url');
var configApiServer = require(process.mainModule.exports["corePath"] +
                              '/src/serverroot/common/configServer.api');
/**
 * @parseProjectQuotas
 * private function
 * 1. prepares the quota object from the project response
 */
function parseProjectQuotas(error, projData, appData, callback)
{
    var quotaData =  projData["project"]["quota"];
    if(quotaData != undefined) {
         var resQuota = {};
         resQuota.quota = quotaData;
         callback(error, resQuota);
    }
    else {
        callback(error, null);
    }
}

/**
 * @getProjectQuotasCb
 * private function
 * 1. Callback for getProjectQuotas
 * 2. Reads the response of a particular project from config api server
 */
function getProjectQuotasCb (error, projectGetData, appData, callback)
{
    if (error) {
       callback(error, null);
       return;
    }
    parseProjectQuotas(error, projectGetData, appData, callback);    
}

/**
 * @readProjectQuotas
 * private function
 * 1. Needs project uuid in string format
 */
function readProjectQuotas (projectIdStr, appData, callback)
{
    var quotasGetURL = '/project/';
    if (projectIdStr.length) {
        quotasGetURL += projectIdStr;
    } else {
        error = new appErrors.RESTServerError('Add Project id');
        callback(error, null);
        return;
    }
    configApiServer.apiGet(quotasGetURL, appData,
                         function(error, data) {
                             if (error) {
                                 callback(error, null);
                                 return;
                             }
                             if(data["project"]["quota"] != undefined) {
                                 getProjectQuotasCb(error, data, appData, callback);
                             } else     {
                                 setProjectQuotas(projectIdStr, appData, data, callback);
                             }    
                         }
    );
}

/**
 * @setProjectQuotas
 * private function
 * 1. Needs project uuid in string format
 */
function setProjectQuotas(projectIdStr, appData, data, callback) {
    var url = "/project/";
    url += projectIdStr ;
    data["project"]["quota"] = {
                                   "subnet": -1,
                                   "virtual_machine_interface": -1,
                                   "bgp_router": null,
                                   "instance_ip": null,
                                   "service_instance": null,
                                   "network_ipam": null,
                                   "virtual_DNS_record": null,
                                   "service_template": null,
                                   "global_vrouter_config": null,
                                   "floating_ip": -1,
                                   "virtual_router": null,
                                   "security_group_rule": -1,
                                   "access_control_list": null,
                                   "defaults": null,
                                   "security_group": -1,
                                   "virtual_network": -1,
                                   "virtual_DNS": null,
                                   "floating_ip_pool": null,
                                   "logical_router": -1,
                                   "loadbalancer_pool":-1,
                                   "loadbalancer_member":-1,
                                   "loadbalancer_healthmonitor":-1,
                                   "virtual_ip":-1
                               };
    getProjectQuotasCb(null, data, appData, callback);
}
    
/**
 * @getProjectQuotas
 * public function
 * 1. URL /api/tenants/config/project-quotas/:id
 * 2. Gets project quotas from config api server
 * 3. Needs project id
 */
function getProjectQuotas (request, response, appData) 
{
    var projectId = validateProjectId(request);
    projectQuotasAPIGet(projectId, response, appData);
}   

/**
 * @updateProjectQuotas
 * public function
 * 1. URL /api/tenants/config/update-quotas/:id
 * 2. Updates project quotas in config api server
 * 3. Needs project id
 */
function updateProjectQuotas(request, response, appData) 
{
    var projectId = validateProjectId(request);
    var updateData = request.body; 
    var url = "/project/";
    url += projectId ;
    var putObj = {};
    putObj.project = {uuid : projectId, quota : updateData.quota};
    configApiServer.apiPut(url, putObj, appData, function(err, data){
        if (err) {
            commonUtils.handleJSONResponse(err, response, null);
            return;
        }  
        commonUtils.handleJSONResponse(err, response, data);
    });    
}

function projectQuotasAPIGet(projectId, response, appData) {
    readProjectQuotas(projectId, appData,
                   function(err, data) {
        commonUtils.handleJSONResponse(err, response, data);
    });   
}

function processAsyncReq(req, callback) {
    configApiServer.apiGet(req.url, req.appData, function(err, data){
        callback(err, data);
    });            
}

/**
 * @getProjectQuotaUsedInfo
 * public function
 * 1. URL /api/tenants/config/quota-used/:name
 * 2. Gets all project resources from config api server to get the count 
 * 3. Needs project name
 */
function getProjectQuotaUsedInfo(request, response, appData)
{
    var usedResCnt = {};
    var projId = validateProjectId(request);
    var resources = [{key : 'floating-ips', value : 'floating_ip'},
        {key : 'floating-ip-pools', value : 'floating_ip_pool'},
        {key : 'network-ipams', value : 'network_ipam'},
        {key : 'security-groups', value : 'security_group'}, 
        {key : 'service-instances', value : 'service_instance'},
        {key : 'virtual-networks', value : 'virtual_network'},
        {key : 'virtual-machine-interfaces', value : 'virtual_machine_interface'},
        {key : 'access-control-lists', value : 'access_control_list'},
        {key : 'network-policys', value : 'network_policy'},
        {key : 'logical-routers', value : 'logical_router'},
        {key : 'loadbalancer-pools', value : 'loadbalancer_pool'},
        {key : 'loadbalancer-members', value : 'loadbalancer_member'},
        {key : 'loadbalancer-healthmonitors', value : 'loadbalancer_healthmonitor'},
        {key : 'virtual-ips', value : 'virtual_ip'}
    ];
    var callObj = [];
    for(var featureCnt = 0; featureCnt < resources.length; featureCnt ++) {
        var reqObj = {};
        reqObj.url = '/' + resources[featureCnt].key + '?parent_id=' + projId + '&count=true';
        reqObj.appData = appData;
        callObj.push(reqObj);         
    }
    async.map(callObj, processAsyncReq, function(err, data){
        if (err || data == null) {
            commonUtils.handleJSONResponse(err, response, null);
            return;
        }
        var dataLength = data.length;
        var resLength = resources.length;
        for(var dataCnt = 0; dataCnt < dataLength ; dataCnt++) {
            for(var i = 0; i <  resLength; i++) {
                var resource = resources[i];
                if(resource.key in data[dataCnt]) {
                    var resCnt =  data[dataCnt][resource.key].count;
                    usedResCnt[resource.value] = resCnt;
                }
            }
        }
        getSubNetsUsedInfo(projId, usedResCnt, appData, function(err, usedInfoSubnetCnt) {
            if(err) {
                commonUtils.handleJSONResponse(err, response, null);
                return;
            }
            getSecurityGroupRule(projId, usedInfoSubnetCnt, appData, function(err, finalUsedInfo) {
                if(err) {
                    commonUtils.handleJSONResponse(err, response, null);
                    return;
                }
                commonUtils.handleJSONResponse(err, response, finalUsedInfo);
            });
        });
    });  
}

function getSubNetsUsedInfo(projId, usedResCnt, appData, callback)
{
    //prepare used info count for subnets
    var vnDetailsURL = '/virtual-networks?parent_id=' + projId + '&detail=true&fields=network_ipam_refs';
    configApiServer.apiGet(vnDetailsURL, appData,
        function(err, resData) {
            if (!err) {
                var resCnt = 0;
                resData = resData['virtual-networks'];
                if(resData != null) {
                    var resLength = resData.length;
                    for(var resDataCnt = 0; resDataCnt < resLength; resDataCnt++) {
                        var ipams = resData[resDataCnt]['virtual-network']['network_ipam_refs'];
                        if(ipams) {
                            var ipamsLength = ipams.length;
                            for(var ipamCnt = 0; ipamCnt < ipamsLength; ipamCnt++) {
                                var attr = ipams[ipamCnt]['attr'];
                                var subnetsCnt =  attr['ipam_subnets'] ? attr['ipam_subnets'].length : 0;
                                resCnt = resCnt + subnetsCnt;
                            }
                        }
                    }
                }
                usedResCnt['subnet'] = resCnt;
            }
            callback(err, usedResCnt);
        }
    );
}

function getSecurityGroupRule(projId, usedResCnt, appData, callback)
{
    //prepare used info count for security group rules
    var sgDetailsURL = '/security-groups?parent_id=' + projId + '&detail=true&fields=security_group_entries';
    configApiServer.apiGet(sgDetailsURL, appData,
        function(err, resData) {
            if (!err) {
                var subGrpCnt = 0;
                resData = resData['security-groups'];
                if(resData != null) {
                    var resLength = resData.length;
                    for(var resDataCnt = 0; resDataCnt < resLength; resDataCnt++) {
                        var sg = resData[resDataCnt]['security-group']['security_group_entries'];
                        subGrpCnt += sg['policy_rule'] ? sg['policy_rule'].length : 0;
                    }
                }
                usedResCnt['security_group_rule'] = subGrpCnt;
            }
            callback(err, usedResCnt);
        }
    );
}

function validateProjectId (request) 
{
    var projectId = null;
    if (!(projectId = request.param('id').toString())) {
        error = new appErrors.RESTServerError('Add Project id');
        commonUtils.handleJSONResponse(error, response, null);
        return;
    }
    return projectId;
}

function validateProjectName (request) 
{
    var projectName = null;
    if (!(projectName = request.param('name').toString())) {
        error = new appErrors.RESTServerError('Add Project Name');
        commonUtils.handleJSONResponse(error, response, null);
        return;
    }
    return projectName;
}
    
 /* List all public function here */
 
 exports.getProjectQuotas = getProjectQuotas;
 exports.updateProjectQuotas = updateProjectQuotas;
 exports.getProjectQuotaUsedInfo = getProjectQuotaUsedInfo;
