import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean { 
        const requiedRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY,[    
        context.getHandler(),
        context.getClass(),    
        ])

        if (!requiedRoles || requiedRoles.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest()
        if (!user || !user.role){
            throw new ForbiddenException("Anda tidak memiliki akses disini")
        }
        return requiedRoles.some((role) => user.role === role)
    }
}