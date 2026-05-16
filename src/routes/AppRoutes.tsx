import { useRoutes } from "react-router-dom";
import { routes } from "./routeConfig";

export default function AppRoutes() {
    return useRoutes(routes);
}