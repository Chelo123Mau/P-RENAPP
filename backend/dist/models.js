"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportTipo = exports.RefTipo = exports.Estado = exports.DraftState = exports.ApproveState = void 0;
var ApproveState;
(function (ApproveState) {
    ApproveState["PENDIENTE"] = "PENDIENTE";
    ApproveState["APROBADO"] = "APROBADO";
    ApproveState["RECHAZADO"] = "RECHAZADO";
})(ApproveState || (exports.ApproveState = ApproveState = {}));
var DraftState;
(function (DraftState) {
    DraftState["DRAFT"] = "DRAFT";
    DraftState["SUBMITTED"] = "SUBMITTED";
})(DraftState || (exports.DraftState = DraftState = {}));
var Estado;
(function (Estado) {
    Estado["REVISION"] = "REVISION";
    Estado["APROBADO"] = "APROBADO";
    Estado["OBSERVADO"] = "OBSERVADO";
})(Estado || (exports.Estado = Estado = {}));
var RefTipo;
(function (RefTipo) {
    RefTipo["USUARIO"] = "USUARIO";
    RefTipo["ENTIDAD"] = "ENTIDAD";
    RefTipo["PROYECTO"] = "PROYECTO";
})(RefTipo || (exports.RefTipo = RefTipo = {}));
var ReportTipo;
(function (ReportTipo) {
    ReportTipo["APROBACION"] = "APROBACION";
    ReportTipo["OBSERVACIONES"] = "OBSERVACIONES";
})(ReportTipo || (exports.ReportTipo = ReportTipo = {}));
