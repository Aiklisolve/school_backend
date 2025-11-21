// src/controllers/parentStudentRelationshipController.js
import {
    createRelationship,
    listRelationships,
    getRelationshipsByStudent,
    getRelationshipsByParent,
    updateRelationship,
    deleteRelationship,
  } from "../services/parentStudentRelationshipService.js";
  
  const ALLOWED_REL_TYPES = [
    "FATHER",
    "MOTHER",
    "GUARDIAN",
    "UNCLE",
    "AUNT",
    "GRANDFATHER",
    "GRANDMOTHER",
  ];
  
  // POST /api/relationships
  export async function createRelationshipController(req, res) {
    try {
      const {
        parent_id,
        student_id,
        relationship_type,
        is_primary_contact,
        is_fee_responsible,
        is_emergency_contact,
      } = req.body;
  
      if (!parent_id || !student_id || !relationship_type) {
        return res.status(400).json({
          status: "error",
          message: "parent_id, student_id, and relationship_type are required",
        });
      }
  
      if (!ALLOWED_REL_TYPES.includes(relationship_type)) {
        return res.status(400).json({
          status: "error",
          message: `Invalid relationship_type. Allowed: ${ALLOWED_REL_TYPES.join(", ")}`,
        });
      }
  
      const relationship = await createRelationship({
        parent_id,
        student_id,
        relationship_type,
        is_primary_contact: !!is_primary_contact,
        is_fee_responsible: !!is_fee_responsible,
        is_emergency_contact: !!is_emergency_contact,
      });
  
      return res.status(201).json({
        status: "success",
        message: "Relationship created",
        data: relationship,
      });
    } catch (err) {
      console.error("Create relationship error:", err);
  
      if (err.code === "relationship_already_exists") {
        return res.status(409).json({
          status: "error",
          message: "Relationship already exists for this parent/student/type",
        });
      }
  
      if (err.code === "primary_contact_already_exists") {
        return res.status(409).json({
          status: "error",
          message: "There is already a primary contact for this student",
        });
      }
  
      return res.status(500).json({
        status: "error",
        message: "Internal server error while creating relationship",
      });
    }
  }
  
  // GET /api/relationships?parent_id=&student_id=&relationship_type=&page=&pageSize=
  export async function listRelationshipsController(req, res) {
    try {
      const {
        parent_id,
        student_id,
        relationship_type,
        page = "1",
        pageSize = "20",
      } = req.query;
  
      const result = await listRelationships({
        parent_id: parent_id ? Number(parent_id) : undefined,
        student_id: student_id ? Number(student_id) : undefined,
        relationship_type: relationship_type || undefined,
        page: Number(page),
        pageSize: Number(pageSize),
      });
  
      return res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (err) {
      console.error("List relationships error:", err);
      return res.status(500).json({
        status: "error",
        message: "Internal server error while listing relationships",
      });
    }
  }
  
  // GET /api/relationships/student/:studentId
  export async function getByStudentController(req, res) {
    try {
      const { studentId } = req.params;
      if (!studentId) {
        return res.status(400).json({
          status: "error",
          message: "studentId is required",
        });
      }
  
      const result = await getRelationshipsByStudent(Number(studentId));
      return res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (err) {
      console.error("Get relationships by student error:", err);
      return res.status(500).json({
        status: "error",
        message: "Internal server error while fetching relationships",
      });
    }
  }
  
  // GET /api/relationships/parent/:parentId
  export async function getByParentController(req, res) {
    try {
      const { parentId } = req.params;
      if (!parentId) {
        return res.status(400).json({
          status: "error",
          message: "parentId is required",
        });
      }
  
      const result = await getRelationshipsByParent(Number(parentId));
      return res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (err) {
      console.error("Get relationships by parent error:", err);
      return res.status(500).json({
        status: "error",
        message: "Internal server error while fetching relationships",
      });
    }
  }
  
  // PATCH /api/relationships/:relationshipId
  export async function updateRelationshipController(req, res) {
    try {
      const { relationshipId } = req.params;
      const {
        relationship_type,
        is_primary_contact,
        is_fee_responsible,
        is_emergency_contact,
      } = req.body;
  
      const fields = {};
  
      if (relationship_type) {
        if (!ALLOWED_REL_TYPES.includes(relationship_type)) {
          return res.status(400).json({
            status: "error",
            message: `Invalid relationship_type. Allowed: ${ALLOWED_REL_TYPES.join(", ")}`,
          });
        }
        fields.relationship_type = relationship_type;
      }
  
      if (typeof is_primary_contact === "boolean") {
        fields.is_primary_contact = is_primary_contact;
      }
      if (typeof is_fee_responsible === "boolean") {
        fields.is_fee_responsible = is_fee_responsible;
      }
      if (typeof is_emergency_contact === "boolean") {
        fields.is_emergency_contact = is_emergency_contact;
      }
  
      const updated = await updateRelationship(Number(relationshipId), fields);
  
      if (!updated) {
        return res.status(404).json({
          status: "error",
          message: "Relationship not found",
        });
      }
  
      return res.status(200).json({
        status: "success",
        message: "Relationship updated",
        data: updated,
      });
    } catch (err) {
      console.error("Update relationship error:", err);
  
      if (err.code === "primary_contact_already_exists") {
        return res.status(409).json({
          status: "error",
          message: "There is already a primary contact for this student",
        });
      }
  
      if (err.message === "no_fields_to_update") {
        return res.status(400).json({
          status: "error",
          message: "No fields provided to update",
        });
      }
  
      return res.status(500).json({
        status: "error",
        message: "Internal server error while updating relationship",
      });
    }
  }
  
  // DELETE /api/relationships/:relationshipId
  export async function deleteRelationshipController(req, res) {
    try {
      const { relationshipId } = req.params;
  
      const ok = await deleteRelationship(Number(relationshipId));
      if (!ok) {
        return res.status(404).json({
          status: "error",
          message: "Relationship not found",
        });
      }
  
      return res.status(200).json({
        status: "success",
        message: "Relationship deleted",
      });
    } catch (err) {
      console.error("Delete relationship error:", err);
      return res.status(500).json({
        status: "error",
        message: "Internal server error while deleting relationship",
      });
    }
  }
  