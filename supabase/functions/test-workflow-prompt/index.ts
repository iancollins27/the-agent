
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleRequest } from './handlers/handleRequest.ts';

console.log("Starting test-workflow-prompt function");

serve(handleRequest);
