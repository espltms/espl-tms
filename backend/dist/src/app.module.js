"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const prisma_module_1 = require("./infrastructure/database/prisma.module");
const dispatch_gateway_1 = require("./infrastructure/socket/dispatch.gateway");
const jwt_strategy_1 = require("./infrastructure/security/jwt.strategy");
const auth_controller_1 = require("./interface/controllers/auth.controller");
const trip_controller_1 = require("./interface/controllers/trip.controller");
const compliance_controller_1 = require("./interface/controllers/compliance.controller");
const finance_controller_1 = require("./interface/controllers/finance.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            prisma_module_1.PrismaModule,
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.register({
                global: true,
                secret: process.env.JWT_SECRET || 'ProductionEnterpriseSuperSecretJWTKey2026!!',
                signOptions: { expiresIn: '8h' },
            }),
        ],
        controllers: [
            auth_controller_1.AuthController,
            trip_controller_1.TripController,
            compliance_controller_1.ComplianceController,
            finance_controller_1.FinanceController,
        ],
        providers: [
            jwt_strategy_1.JwtStrategy,
            dispatch_gateway_1.DispatchGateway,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map