package main

import (
    "encoding/json"
    "fmt"
    "log"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing CDMS data
type SmartContract struct {
    contractapi.Contract
}

// --------------------------- DOCUMENT TYPES -------------------------
type Record struct {
    DocType     string `json:"docType"`
    ID          string `json:"id"`
    CaseID      string `json:"caseId"`
    RecordType  string `json:"recordType"`
    FileHash    string `json:"fileHash"`
    OffChainURI string `json:"offChainUri"`
    OwnerOrg    string `json:"ownerOrg"`
    CreatedAt   string `json:"createdAt"`
    PolicyID    string `json:"policyId"`
    Description string `json:"description"`
}

// (rules removed) Using simplified policy: AllowedOrgs and AllowedRoles arrays

type Policy struct {
    DocType    string   `json:"docType"`
    PolicyID   string   `json:"policyId"`
    Categories []string `json:"categories"`
    AllowedOrgs  []string `json:"allowedOrgs,omitempty"`
    AllowedRoles []string `json:"allowedRoles,omitempty"`
    CreatedAt  string   `json:"createdAt"`
    CreatedBy  string   `json:"createdBy"`
}

type Organization struct {
    DocType string   `json:"docType"`
    OrgID   string   `json:"orgId"`
    Name    string   `json:"name"`
    MspID   string   `json:"mspId"`
    Members []string `json:"members"`
}

type User struct {
    DocType      string `json:"docType"`
    Username     string `json:"username"`
    FullName     string `json:"fullName"`
    Email        string `json:"email"`
    Role         string `json:"role"`
    Organization string `json:"organization"`
    PasswordHash string `json:"passwordHash"` // stored bcrypt hash (backend must supply)
    CreatedAt    string `json:"createdAt"`
}

type Case struct {
    DocType     string `json:"docType"`
    ID          string `json:"id"`
    Title       string `json:"title"`
    Description string `json:"description"`
    Status      string `json:"status"`
    Jurisdiction string `json:"jurisdiction"`
    CaseType    string `json:"caseType"`
    CreatedBy   string `json:"createdBy"`
    CreatedAt   string `json:"createdAt"`
    Organization string `json:"organization"`
    PolicyID    string `json:"policyId"`     // Policy controlling access to this case
}

// --------------------------- POLICIES --------------------------------

// CreatePolicy creates a policy. categoriesJSON, allowedOrgsJSON and allowedRolesJSON are JSON strings.
func (s *SmartContract) CreatePolicy(ctx contractapi.TransactionContextInterface, policyId string, categoriesJSON string, allowedOrgsJSON string, allowedRolesJSON string) error {
    key := "policy:" + policyId
    exists, err := ctx.GetStub().GetState(key)
    if err != nil {
        return fmt.Errorf("failed to check if policy exists: %v", err)
    }
    if exists != nil {
        return fmt.Errorf("the policy %s already exists", policyId)
    }

    var categories []string
    if err := json.Unmarshal([]byte(categoriesJSON), &categories); err != nil {
        return fmt.Errorf("failed to unmarshal categories JSON: %v", err)
    }

    var allowedOrgs []string
    if err := json.Unmarshal([]byte(allowedOrgsJSON), &allowedOrgs); err != nil {
        return fmt.Errorf("failed to unmarshal allowedOrgs JSON: %v", err)
    }

    var allowedRoles []string
    if err := json.Unmarshal([]byte(allowedRolesJSON), &allowedRoles); err != nil {
        return fmt.Errorf("failed to unmarshal allowedRoles JSON: %v", err)
    }

    clientMSPID, _ := ctx.GetClientIdentity().GetMSPID()

    policy := Policy{
        DocType:    "policy",
        PolicyID:   policyId,
        Categories: categories,
        AllowedOrgs:  allowedOrgs,
        AllowedRoles: allowedRoles,
        CreatedBy:  clientMSPID,
        CreatedAt:  "auto-generated",
    }

    policyJSON, err := json.Marshal(policy)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(key, policyJSON)
}

// QueryPolicy returns policy details
func (s *SmartContract) QueryPolicy(ctx contractapi.TransactionContextInterface, policyId string) (*Policy, error) {
    key := "policy:" + policyId
    policyJSON, err := ctx.GetStub().GetState(key)
    if err != nil {
        return nil, fmt.Errorf("failed to read policy from world state: %v", err)
    }
    if policyJSON == nil {
        return nil, fmt.Errorf("the policy %s does not exist", policyId)
    }
    var policy Policy
    if err := json.Unmarshal(policyJSON, &policy); err != nil {
        return nil, err
    }

    // No additional normalization required for simplified policy

    return &policy, nil
}

// QueryAllPolicies returns all policies
func (s *SmartContract) QueryAllPolicies(ctx contractapi.TransactionContextInterface) ([]*Policy, error) {
    // --- FIX for LevelDB ---
    // Use GetStateByRange instead of GetQueryResult
    startKey := "policy:"
    endKey := "policy:\uffff"

    resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
    if err != nil {
        return nil, fmt.Errorf("failed to execute policy query: %v", err)
    }
    defer resultsIterator.Close()

    var policies []*Policy
    for resultsIterator.HasNext() {
        qr, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        var p Policy
        if err := json.Unmarshal(qr.Value, &p); err != nil {
            return nil, err
        }

            // simplified policy object - just append if docType matches
            if p.DocType == "policy" {
                policies = append(policies, &p)
            }
    }
    return policies, nil
}

// --------------------------- ORGANIZATIONS ---------------------------

// --- NEW FUNCTION for LevelDB ---
// QueryAllOrganizations returns all organizations
func (s *SmartContract) QueryAllOrganizations(ctx contractapi.TransactionContextInterface) ([]*Organization, error) {
    startKey := "org:"
    endKey := "org:\uffff"

    resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
    if err != nil {
        return nil, fmt.Errorf("failed to execute org query: %v", err)
    }
    defer resultsIterator.Close()

    var orgs []*Organization
    for resultsIterator.HasNext() {
        qr, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        var o Organization
        if err := json.Unmarshal(qr.Value, &o); err != nil {
            return nil, err
        }
        
        if o.DocType == "org" {
             orgs = append(orgs, &o)
        }
    }
    return orgs, nil
}


func (s *SmartContract) QueryOrganization(ctx contractapi.TransactionContextInterface, orgId string) (*Organization, error) {
    key := "org:" + orgId
    orgJSON, err := ctx.GetStub().GetState(key)
    if err != nil {
        return nil, fmt.Errorf("failed to read organization: %v", err)
    }
    if orgJSON == nil {
        return nil, fmt.Errorf("organization %s not found", orgId)
    }
    var org Organization
    if err := json.Unmarshal(orgJSON, &org); err != nil {
        return nil, err
    }
    return &org, nil
}

func (s *SmartContract) QueryOrganizationMembers(ctx contractapi.TransactionContextInterface, orgId string) ([]string, error) {
    org, err := s.QueryOrganization(ctx, orgId)
    if err != nil {
        return nil, err
    }
    return org.Members, nil
}

// --------------------------- USERS ---------------------------------

// CreateUser stores a user including a password hash.
// passwordHash must be generated and provided by backend (bcrypt).
func (s *SmartContract) CreateUser(ctx contractapi.TransactionContextInterface, username, fullName, email, role, organization, passwordHash string) error {
    key := "user:" + username
    exists, err := ctx.GetStub().GetState(key)
    if err != nil {
        return fmt.Errorf("failed to check user: %v", err)
    }
    if exists != nil {
        return fmt.Errorf("user %s already exists", username)
    }

    user := User{
        DocType:      "user",
        Username:     username,
        FullName:     fullName,
        Email:        email,
        Role:         role,
        Organization: organization,
        PasswordHash: passwordHash,
        CreatedAt:    "auto-generated",
    }

    userJSON, err := json.Marshal(user)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(key, userJSON)
}

// QueryUser returns a user (including PasswordHash for auth verification by backend).
func (s *SmartContract) QueryUser(ctx contractapi.TransactionContextInterface, username string) (*User, error) {
    key := "user:" + username
    userJSON, err := ctx.GetStub().GetState(key)
    if err != nil {
        return nil, fmt.Errorf("failed to read user: %v", err)
    }
    if userJSON == nil {
        return nil, fmt.Errorf("user %s not found", username)
    }
    var user User
    if err := json.Unmarshal(userJSON, &user); err != nil {
        return nil, err
    }
    return &user, nil
}

// --------------------------- CASES ---------------------------------

func (s *SmartContract) CreateCase(ctx contractapi.TransactionContextInterface, id, title, description, jurisdiction, caseType, policyId string) error {
    key := "case:" + id
    exists, err := ctx.GetStub().GetState(key)
    if err != nil {
        return fmt.Errorf("failed to check case: %v", err)
    }
    if exists != nil {
        return fmt.Errorf("case %s already exists", id)
    }

    // Verify policy exists and creator has access
    if policyId != "" {
        policy, err := s.QueryPolicy(ctx, policyId)
        if err != nil {
            return fmt.Errorf("failed to get policy %s: %v", policyId, err)
        }
        clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
        if err != nil {
            return fmt.Errorf("failed to get client MSP ID: %v", err)
        }
        
        // Check if org is allowed by policy
        orgAllowed := false
        for _, o := range policy.AllowedOrgs {
            if o == clientMSPID || o == "*" {
                orgAllowed = true
                break
            }
        }
        if !orgAllowed {
            return fmt.Errorf("organization %s not allowed by policy %s", clientMSPID, policyId)
        }
    }

    clientMSPID, _ := ctx.GetClientIdentity().GetMSPID()

    caseObj := Case{
        DocType:     "case",
        ID:          id,
        Title:       title,
        Description: description,
        Status:      "Open",
        Jurisdiction: jurisdiction,
        CaseType:    caseType,
        CreatedBy:   clientMSPID,
        CreatedAt:   "auto-generated",
        Organization: clientMSPID,
        PolicyID:    policyId,
    }

    caseJSON, err := json.Marshal(caseObj)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(key, caseJSON)
}

func (s *SmartContract) QueryCase(ctx contractapi.TransactionContextInterface, id string, userRole string) (*Case, error) {
    key := "case:" + id
    caseJSON, err := ctx.GetStub().GetState(key)
    if err != nil {
        return nil, fmt.Errorf("failed to read case: %v", err)
    }
    if caseJSON == nil {
        return nil, fmt.Errorf("case %s not found", id)
    }
    var caseObj Case
    if err := json.Unmarshal(caseJSON, &caseObj); err != nil {
        return nil, err
    }

    // If case has a policy, check access
    if caseObj.PolicyID != "" {
        // Get client org for policy check
        clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
        if err != nil {
            return nil, fmt.Errorf("failed to get client MSP ID: %v", err)
        }

        policy, err := s.QueryPolicy(ctx, caseObj.PolicyID)
        if err != nil {
            return nil, fmt.Errorf("failed to get policy %s: %v", caseObj.PolicyID, err)
        }

        // Check access using simplified policy: require org AND role to match allowed lists
        orgAllowed := false
        roleAllowed := false

        for _, o := range policy.AllowedOrgs {
            if o == clientMSPID || o == "*" {
                orgAllowed = true
                break
            }
        }

        for _, r := range policy.AllowedRoles {
            if r == userRole || r == "*" {
                roleAllowed = true
                break
            }
        }

        if !(orgAllowed && roleAllowed) {
            return nil, fmt.Errorf("access denied by policy for organization %s and role %s", clientMSPID, userRole)
        }
    }

    return &caseObj, nil
}

// QueryAllCases supports optional rich query passed as filters JSON. If filters is empty, returns all cases.
func (s *SmartContract) QueryAllCases(ctx contractapi.TransactionContextInterface, filters string, userRole string) ([]*Case, error) {
    // --- FIX for LevelDB ---
    // GetStateByRange does not support filters. We will get all cases.
    // A warning is logged if filters were provided, as they will be ignored.
    if filters != "" {
        log.Printf("Warning: QueryAllCases filters are ignored due to LevelDB limitations. Returning all cases.")
    }
    
    startKey := "case:"
    endKey := "case:\uffff"

    resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
    if err != nil {
        return nil, fmt.Errorf("failed to execute case query: %v", err)
    }
    defer resultsIterator.Close()

    clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
    if err != nil {
        return nil, fmt.Errorf("failed to get client MSP ID: %v", err)
    }

    var cases []*Case
    for resultsIterator.HasNext() {
        qr, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        var c Case
        if err := json.Unmarshal(qr.Value, &c); err != nil {
            return nil, err
        }
        
        if c.DocType == "case" {
            // If case has no policy, include it
            if c.PolicyID == "" {
                cases = append(cases, &c)
                continue
            }

            // Check policy access
            policy, err := s.QueryPolicy(ctx, c.PolicyID)
            if err != nil {
                log.Printf("Warning: Could not check policy %s for case %s: %v", c.PolicyID, c.ID, err)
                continue
            }

            // Check access using simplified policy
            orgAllowed := false
            roleAllowed := false

            for _, o := range policy.AllowedOrgs {
                if o == clientMSPID || o == "*" {
                    orgAllowed = true
                    break
                }
            }

            for _, r := range policy.AllowedRoles {
                if r == userRole || r == "*" {
                    roleAllowed = true
                    break
                }
            }

            if orgAllowed && roleAllowed {
                cases = append(cases, &c)
            }
        }
    }
    return cases, nil
}

func (s *SmartContract) DeleteCase(ctx contractapi.TransactionContextInterface, id string) error {
    key := "case:" + id
    exists, err := ctx.GetStub().GetState(key)
    if err != nil {
        return fmt.Errorf("failed to check case: %v", err)
    }
    if exists == nil {
        return fmt.Errorf("case %s does not exist", id)
    }
    return ctx.GetStub().DelState(key)
}

// --------------------------- RECORDS --------------------------------

// CreateRecord stores a Record. Backend should supply createdAt and ownerOrg.
func (s *SmartContract) CreateRecord(ctx contractapi.TransactionContextInterface, id, caseId, recordType, fileHash, offChainUri, ownerOrg, createdAt, policyId, description string) error {
    key := "record:" + id
    exists, err := ctx.GetStub().GetState(key)
    if err != nil {
        return fmt.Errorf("failed to check record: %v", err)
    }
    if exists != nil {
        return fmt.Errorf("record %s already exists", id)
    }

    rec := Record{
        DocType:     "record",
        ID:          id,
        CaseID:      caseId,
        RecordType:  recordType,
        FileHash:    fileHash,
        OffChainURI: offChainUri,
        OwnerOrg:    ownerOrg,
        CreatedAt:   createdAt,
        PolicyID:    policyId,
        Description: description,
    }

    recJSON, err := json.Marshal(rec)
    if err != nil {
        return err
    }
    return ctx.GetStub().PutState(key, recJSON)
}

func (s *SmartContract) QueryRecord(ctx contractapi.TransactionContextInterface, id string, userRole string) (*Record, error) {
    key := "record:" + id
    recJSON, err := ctx.GetStub().GetState(key)
    if err != nil {
        return nil, fmt.Errorf("failed to read record: %v", err)
    }
    if recJSON == nil {
        return nil, fmt.Errorf("record %s not found", id)
    }
    var rec Record
    if err := json.Unmarshal(recJSON, &rec); err != nil {
        return nil, err
    }

    // Get client org and role for policy check
    clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
    if err != nil {
        return nil, fmt.Errorf("failed to get client MSP ID: %v", err)
    }

    // Get the policy
    if rec.PolicyID == "" {
        return nil, fmt.Errorf("record %s has no associated policy", id)
    }

    policy, err := s.QueryPolicy(ctx, rec.PolicyID)
    if err != nil {
        return nil, fmt.Errorf("failed to get policy %s: %v", rec.PolicyID, err)
    }

    // Check access using simplified policy: require org AND role to match allowed lists
    orgAllowed := false
    roleAllowed := false

    for _, o := range policy.AllowedOrgs {
        if o == clientMSPID || o == "*" {
            orgAllowed = true
            break
        }
    }

    for _, r := range policy.AllowedRoles {
        if r == userRole || r == "*" {
            roleAllowed = true
            break
        }
    }

    if !(orgAllowed && roleAllowed) {
        return nil, fmt.Errorf("access denied by policy for organization %s and role %s", clientMSPID, userRole)
    }

    return &rec, nil
}

// QueryRecordsByCase returns records belonging to a case
func (s *SmartContract) QueryRecordsByCase(ctx contractapi.TransactionContextInterface, caseId string) ([]*Record, error) {
    // --- FIX for LevelDB ---
    // We must get all records and filter them in-memory
    startKey := "record:"
    endKey := "record:\uffff"

    resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
    if err != nil {
        return nil, fmt.Errorf("failed to execute query: %v", err)
    }
    defer resultsIterator.Close()

    clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
    if err != nil {
        return nil, fmt.Errorf("failed to get client MSP ID: %v", err)
    }

    var records []*Record
    for resultsIterator.HasNext() {
        qr, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        var r Record
        if err := json.Unmarshal(qr.Value, &r); err != nil {
            return nil, err
        }

        // Manual in-memory filtering
        if r.DocType == "record" && r.CaseID == caseId {
            // Check policy for each record
            if r.PolicyID == "" {
                continue // Skip records without policy
            }

            policy, err := s.QueryPolicy(ctx, r.PolicyID)
            if err != nil {
                continue // Skip if policy can't be retrieved
            }

            // Check if org is allowed by simplified policy (role not available here)
            hasAccess := false
            for _, o := range policy.AllowedOrgs {
                if o == clientMSPID || o == "*" {
                    hasAccess = true
                    break
                }
            }

            if hasAccess {
                records = append(records, &r)
            }
        }
    }
    return records, nil
}

// QueryRecords executes a rich query supplied by backend (searchJSON must be a selector query)
func (s *SmartContract) QueryRecords(ctx contractapi.TransactionContextInterface, searchJSON string) ([]*Record, error) {
    // --- FIX for LevelDB ---
    // GetStateByRange does not support filters. We will get all records.
    // A warning is logged if searchJSON was provided, as it will be ignored.
    if searchJSON != "" {
         log.Printf("Warning: QueryRecords searchJSON is ignored due to LevelDB limitations. Returning all records.")
    }

    startKey := "record:"
    endKey := "record:\uffff"

    resultsIterator, err := ctx.GetStub().GetStateByRange(startKey, endKey)
    if err != nil {
        return nil, fmt.Errorf("failed to execute record query: %v", err)
    }
    defer resultsIterator.Close()

    clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
    if err != nil {
        return nil, fmt.Errorf("failed to get client MSP ID: %v", err)
    }

    var records []*Record
    for resultsIterator.HasNext() {
        qr, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }
        var r Record
        if err := json.Unmarshal(qr.Value, &r); err != nil {
            return nil, err
        }
        
        if r.DocType == "record" {
            // Check policy for each record
            if r.PolicyID == "" {
                continue // Skip records without policy
            }

            policy, err := s.QueryPolicy(ctx, r.PolicyID)
            if err != nil {
                continue // Skip if policy can't be retrieved
            }

            // Check if org is allowed by simplified policy (role not available here)
            hasAccess := false
            for _, o := range policy.AllowedOrgs {
                if o == clientMSPID || o == "*" {
                    hasAccess = true
                    break
                }
            }

            if hasAccess {
                records = append(records, &r)
            }
        }
    }
    return records, nil
}

// UpdateRecordMetadata accepts a JSON map of fields to update for a record.
func (s *SmartContract) UpdateRecordMetadata(ctx contractapi.TransactionContextInterface, id string, metadataJSON string) error {
    key := "record:" + id
    recJSON, err := ctx.GetStub().GetState(key)
    if err != nil {
        return fmt.Errorf("failed to read record: %v", err)
    }
    if recJSON == nil {
        return fmt.Errorf("record %s not found", id)
    }

    var rec Record
    if err := json.Unmarshal(recJSON, &rec); err != nil {
        return err
    }

    var updates map[string]interface{}
    if err := json.Unmarshal([]byte(metadataJSON), &updates); err != nil {
        return fmt.Errorf("invalid metadata JSON: %v", err)
    }

    if v, ok := updates["policyId"].(string); ok {
        rec.PolicyID = v
    }
    if v, ok := updates["recordType"].(string); ok {
        rec.RecordType = v
    }
    if v, ok := updates["ownerOrg"].(string); ok {
        rec.OwnerOrg = v
    }
    if v, ok := updates["description"].(string); ok {
        rec.Description = v
    }
    // Accept other metadata fields as needed.

    newJSON, err := json.Marshal(rec)
    if err != nil {
        return err
    }
    return ctx.GetStub().PutState(key, newJSON)
}

// --------------------------- MAIN ----------------------------------
func main() {
    chaincode, err := contractapi.NewChaincode(&SmartContract{})
    if err != nil {
        log.Panicf("Error creating cdms-chaincode: %v", err)
    }
    if err := chaincode.Start(); err != nil {
        log.Panicf("Error starting cdms-chaincode: %v", err)
    }
}