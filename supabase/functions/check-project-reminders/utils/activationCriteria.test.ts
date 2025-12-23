import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { meetsActivationCriteria } from "./activationCriteria.ts";

Deno.test("meetsActivationCriteria - should return false when no project data is provided", () => {
  const result = meetsActivationCriteria(null);
  assertEquals(result.meetsActivationCriteria, false);
  assertEquals(result.reason, "No project data provided");
});

Deno.test("meetsActivationCriteria - should return false when entry criteria not met", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: null, // Contract not signed
        Roof_Install_Finalized: null,
        Test_Record: false,
        Status: "Active"
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, false);
  assertEquals(result.reason?.includes("entry criteria"), true);
});

Deno.test("meetsActivationCriteria - should return false when status criteria not met", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: "2025-01-01", // Contract signed
        Roof_Install_Finalized: null,
        Test_Record: false,
        Status: "Archived" // Archived status
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, false);
  assertEquals(result.reason?.includes("status"), true);
});

Deno.test("meetsActivationCriteria - should return true when all criteria met", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: "2025-01-01", // Contract signed
        Roof_Install_Finalized: null, // Roof install not finalized
        Test_Record: false, // Not a test record
        Status: "Active" // Active status
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, true);
  assertEquals(result.reason, undefined);
});

Deno.test("meetsActivationCriteria - should handle flat project data structure", () => {
  // Some APIs might return data without the project.fields nesting
  const projectData = {
    Contract_Signed: "2025-01-01",
    Roof_Install_Finalized: null,
    Test_Record: false,
    Status: "Active"
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, true);
});

Deno.test("meetsActivationCriteria - should return false for VOID status", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: "2025-01-01",
        Roof_Install_Finalized: null,
        Test_Record: false,
        Status: "VOID"
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, false);
});

Deno.test("meetsActivationCriteria - should return false for Cancelled status", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: "2025-01-01",
        Roof_Install_Finalized: null,
        Test_Record: false,
        Status: "Cancelled"
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, false);
});

Deno.test("meetsActivationCriteria - should return false for Canceled status (alternative spelling)", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: "2025-01-01",
        Roof_Install_Finalized: null,
        Test_Record: false,
        Status: "Canceled"
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, false);
});

Deno.test("meetsActivationCriteria - should return false when Test_Record is TRUE", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: "2025-01-01",
        Roof_Install_Finalized: null,
        Test_Record: true, // Test record should be excluded
        Status: "Active"
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, false);
});

Deno.test("meetsActivationCriteria - should return false when Roof_Install_Finalized is not null", () => {
  const projectData = {
    project: {
      fields: {
        Contract_Signed: "2025-01-01",
        Roof_Install_Finalized: "2025-02-01", // Roof install is finalized
        Test_Record: false,
        Status: "Active"
      }
    }
  };
  
  const result = meetsActivationCriteria(projectData);
  assertEquals(result.meetsActivationCriteria, false);
});
