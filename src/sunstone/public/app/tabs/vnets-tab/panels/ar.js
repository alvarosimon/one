define(function(require) {
  /*
    DEPENDENCIES
   */

  var TemplateAR = require('hbs!./ar/html');
  var TemplateARInfo = require('hbs!./ar/arInfo');
  var Locale = require('utils/locale');
  var ProgressBar = require('utils/progress-bar');
  var Config = require('sunstone-config');
  var Utils = require('../utils/common');
  var SecurityGroupsTable = require('tabs/secgroups-tab/datatable');

  /*
    CONSTANTS
   */

  var TAB_ID = require('../tabId');
  var PANEL_ID = require('./ar/panelId');
  var SG_TABLE_ID = PANEL_ID + "SecurityGroupsTable";
  var RESOURCE = "Network";
  var XML_ROOT = "VNET";

  /*
    CONSTRUCTOR
   */

  function Panel(info) {
    this.title = Locale.tr("Addresses");
    this.icon = "fa-align-justify";

    this.element = info[XML_ROOT];

    this.last_selected_row_ar = "";

    this.secgroupTable = undefined;

    return this;
  }

  Panel.PANEL_ID = PANEL_ID;
  Panel.prototype.html = _html;
  Panel.prototype.setup = _setup;

  return Panel;

  /*
    FUNCTION DEFINITIONS
   */

  function _html() {
    var arList = Utils.getARList(this.element);
    var processedARList = [];

    for (var i=0; i<arList.length; i++){
      var ar = arList[i];
      var id = ar.AR_ID;

      var type = (ar.TYPE ? ar.TYPE : "--");

      var start = "";

      if(ar.TYPE == "IP4" || ar.TYPE == "IP4_6"){
        start = (ar.IP ? ar.IP : "--");
      } else {
        start = (ar.MAC ? ar.MAC : "--");
      }

      var prefix = "";

      if(ar.GLOBAL_PREFIX && ar.ULA_PREFIX){
        prefix += ar.GLOBAL_PREFIX + "<br>" + ar.ULA_PREFIX;
      } else if (ar.GLOBAL_PREFIX){
        prefix += ar.GLOBAL_PREFIX;
      } else if (ar.ULA_PREFIX){
        prefix += ar.ULA_PREFIX;
      } else {
        prefix = "--";
      }

      var leases = ProgressBar.html(ar.USED_LEASES, ar.SIZE);

      processedARList.push({
        "id" : id,
        "type" : type,
        "start" : start,
        "prefixHTML" : prefix,
        "leasesHTML" : leases
      });
    }

    return TemplateAR({
      'element': this.element,
      'arList' : processedARList
    });
  }

  function _setup(context) {

    var that = this;

    var ar_list_dataTable = $("#ar_list_datatable", context).dataTable({
      "bSortClasses" : false,
      "bDeferRender": true,
      "aoColumnDefs": [
        //{ "bSortable": false, "aTargets": [3,4] },
      ]
    });

    // TODO: should be a method for sunstone-config?
    ar_list_dataTable.fnSort( [ [0,config['user_config']['table_order']] ] );

    ar_list_dataTable.off("click", 'tbody tr');
    ar_list_dataTable.on("click", 'tbody tr', function(e){
      var aData = ar_list_dataTable.fnGetData(this);
      if (!aData) return true;
      var id = aData[0];
      if (!id) return true;

      if(that.last_selected_row_ar) {
        that.last_selected_row_ar.children().each(function(){
          $(this).removeClass('markrowchecked');
        });
      }

      that.last_selected_row_ar = $(this);
      $(this).children().each(function(){
        $(this).addClass('markrowchecked');
      });

      $("#update_ar_button", context).attr("ar_id", id);
      $("#update_ar_button", context).prop("disabled", false);

      $("#rm_ar_button", context).attr("ar_id", id).removeAttr('disabled');

      $("#ar_show_info", context).html(_arHTML(that.element, id));

      _arSetup($("#ar_show_info", context), that.element, id);

      return false;
    });


    if (Config.isTabActionEnabled("vnets-tab", "Network.remove_ar")) {
      context.off("click", 'button#rm_ar_button');
      context.on("click", 'button#rm_ar_button', function(){
        // TODO: confirm?
        var ar_id = $(this).attr('ar_id');

        var obj = {ar_id: ar_id};
        Sunstone.runAction('Network.rm_ar',that.element.ID,obj);

        return false;
      });
    }

    if (Config.isTabActionEnabled("vnets-tab", "Network.add_ar")) {
      context.off("click", 'button#add_ar_button');
      context.on("click", 'button#add_ar_button', function(){
        var id = that.element.ID;

        // TODO: Add AR dialog
        //popUpAddAR(id);

        return false;
      });
    }

    if (Config.isTabActionEnabled("vnets-tab", "Network.update_ar")) {
      context.off("click", 'button#update_ar_button');
      context.on("click", 'button#update_ar_button', function(){
        var id = that.element.ID;
        var ar_id = $(this).attr('ar_id');

        // TODO: update ar dialog
        /*
        OpenNebula.Network.show({
          data : {
              id: id
          },
          timeout: true,
          success: function (request, vn){
              var vn_info = vn.VNET;

              var ar = getAR(vn_info, ar_id);

              if(ar != undefined){
                  popUpUpdateAR(id, ar);
              } else {
                  notifyError(tr("The Adress Range was not found"));
                  Sunstone.runAction("Network.show", id);
              }
          },
          error: onError
        });
        */

        return false;
      });
    }

    return false;
  }


  //============================================================================
  //============================================================================

  // TODO move to util?
  function getAR(vn_info, arId){
    var ar_list = Utils.getARList(vn_info);
    var ar = undefined;

    for (var i=0; i<ar_list.length; i++){
      if (arId == ar_list[i].AR_ID){
        ar = $.extend({}, ar_list[i]);
        break;
      }
    }

    return ar;
  }
  //====


  // TODO: move to its own file?

  function _arHTML(vn_info, arId){
    var ar = getAR(vn_info, arId);

    if(ar == undefined){
        return "";
    }

    var first_mac       = ar.MAC;
    var last_mac        = ar.MAC_END;
    var first_ip        = ar.IP;
    var last_ip         = ar.IP_END;
    var first_ip6_global= ar.IP6_GLOBAL;
    var last_ip6_global = ar.IP6_GLOBAL_END;
    var first_ip6_ula   = ar.IP6_ULA;
    var last_ip6_ula    = ar.IP6_ULA_END;

    var arKnownAttr = [
      {key: Locale.tr("Type"),         value: ar.TYPE},
      {key: Locale.tr("MAC Start"),    value: ar.MAC},
      {key: Locale.tr("IP Start"),     value: ar.IP},
      {key: Locale.tr("Global prefix"),value: ar.GLOBAL_PREFIX},
      {key: Locale.tr("ULA prefix"),   value: ar.ULA_PREFIX},
      {key: Locale.tr("Size"),         value: ar.SIZE},
      {key: Locale.tr("Used leases"),  value: ar.USED_LEASES},
      {key: Locale.tr("Reservation parent AR"),  value: ar.PARENT_NETWORK_AR_ID}
    ];

    delete ar["MAC_END"];
    delete ar["IP_END"];
    delete ar["IP6_ULA"];
    delete ar["IP6_ULA_END"];
    delete ar["IP6_GLOBAL"];
    delete ar["IP6_GLOBAL_END"];
    delete ar["AR_ID"];
    delete ar["TYPE"];
    delete ar["MAC"];
    delete ar["IP"];
    delete ar["GLOBAL_PREFIX"];
    delete ar["ULA_PREFIX"];
    delete ar["SIZE"];
    delete ar["USED_LEASES"];
    delete ar["LEASES"];
    delete ar["PARENT_NETWORK_AR_ID"];

    this.secgroupTable = undefined;
    var secgroupTableHTML = undefined;

    if (ar.SECURITY_GROUPS != undefined &&
        ar.SECURITY_GROUPS.length != 0){

      var secgroups = ar.SECURITY_GROUPS.split(",");

      var opts = {
        info: true,
        select: true,
        selectOptions: {
          read_only: true,
          fixed_ids: secgroups
        }
      };

      this.secgroupTable = new SecurityGroupsTable(SG_TABLE_ID, opts);
      secgroupTableHTML = this.secgroupTable.dataTableHTML;
    }

    delete ar["SECURITY_GROUPS"];

    // TODO bug: extra attributes are not shown

    var arExtraAttr = ar;

    return TemplateARInfo({
      'arId': arId,
      'arKnownAttr': arKnownAttr,
      'arExtraAttr': arExtraAttr,
      'first_mac': first_mac,
      'last_mac': last_mac,
      'first_ip': first_ip,
      'last_ip': last_ip,
      'first_ip6_global': first_ip6_global,
      'last_ip6_global': last_ip6_global,
      'first_ip6_ula': first_ip6_ula,
      'last_ip6_ula': last_ip6_ula,
      'secgroupTableHTML': secgroupTableHTML
    });
  }

  function _arSetup(section, vn_info, ar_id){
    var ar = getAR(vn_info, ar_id);

    if(ar == undefined){
        return;
    }

    if (this.secgroupTable != undefined){
      this.secgroupTable.initialize();
      this.secgroupTable.refreshResourceTableSelect();
    }
  }
});