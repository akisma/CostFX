/**
 * InvestigationWorkflowService - Dave's Investigation Workflow Business Logic
 * 
 * Handles all investigation workflow and management business logic that was previously
 * embedded in the TheoreticalUsageAnalysis model. This service maintains clean
 * separation between data persistence (models) and business logic (services).
 * 
 * Key Responsibilities:
 * - Calculate investigation durations
 * - Determine resolution readiness
 * - Manage investigation assignments and completions
 * - Handle workflow status transitions
 * - Apply Dave's investigation business rules
 * 
 * Author: Architecture Refactoring - Sept 2025
 */

class InvestigationWorkflowService {

  /**
   * Calculate how many days an investigation has been active
   * Dave needs to track investigation SLAs and workflow efficiency
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object with investigationStatus, assignedAt, resolvedAt
   * @returns {number} Number of days in investigation, 0 if not yet assigned
   */
  getDaysInInvestigation(analysis) {
    // Not yet assigned or still pending
    if (analysis.investigationStatus === 'pending' || !analysis.assignedAt) {
      return 0;
    }
    
    const startDate = new Date(analysis.assignedAt);
    const endDate = analysis.resolvedAt ? new Date(analysis.resolvedAt) : new Date();
    return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
  }

  /**
   * Determine if an investigation can be marked as resolved
   * Dave's business rules for investigation completion
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object with investigationStatus, investigatedBy, investigationNotes
   * @returns {boolean} True if investigation can be resolved
   */
  canBeResolved(analysis) {
    // Must be actively investigating or escalated
    const validStatuses = ['investigating', 'escalated'];
    if (!validStatuses.includes(analysis.investigationStatus)) {
      return false;
    }

    // Must have an investigator assigned
    if (!analysis.investigatedBy) {
      return false;
    }

    // Must have investigation notes/findings
    if (!analysis.investigationNotes || analysis.investigationNotes.trim() === '') {
      return false;
    }

    return true;
  }

  /**
   * Prepare assignment data for investigation workflow
   * Dave's investigation assignment business logic
   * 
   * @param {string} userId - ID of user being assigned
   * @param {string|null} notes - Optional initial investigation notes
   * @returns {Object} Update data for investigation assignment
   */
  prepareAssignmentData(userId, notes = null) {
    if (!userId) {
      throw new Error('User ID is required for investigation assignment');
    }

    return {
      assignedTo: userId,
      investigationStatus: 'investigating',
      assignedAt: new Date(),
      investigationNotes: notes || null
    };
  }

  /**
   * Prepare resolution data for investigation completion
   * Dave's investigation resolution business logic with automatic status determination
   * 
   * @param {string} userId - ID of user completing the investigation
   * @param {string} explanation - Investigation findings and explanation
   * @param {string} resolution - Intended resolution status ('resolved', 'accepted', 'escalated')
   * @returns {Object} Update data for investigation resolution
   */
  prepareResolutionData(userId, explanation, resolution = 'resolved') {
    if (!userId) {
      throw new Error('User ID is required for investigation resolution');
    }

    if (!explanation || explanation.trim() === '') {
      throw new Error('Explanation is required for investigation resolution');
    }

    const updates = {
      investigatedBy: userId,
      investigationStatus: resolution,
      resolvedAt: new Date(),
      explanation: explanation.trim()
    };

    // Apply Dave's auto-resolution logic
    // If marked as resolved but explanation indicates acceptability, change to accepted
    if (resolution === 'resolved' && this.isExplanationAcceptable(explanation)) {
      updates.investigationStatus = 'accepted';
    }

    return updates;
  }

  /**
   * Determine if investigation explanation indicates acceptable variance
   * Dave's business logic for automatic status classification
   * 
   * @param {string} explanation - Investigation explanation text
   * @returns {boolean} True if explanation indicates acceptable variance
   */
  isExplanationAcceptable(explanation) {
    if (!explanation) return false;

    const lowerExplanation = explanation.toLowerCase();
    const acceptableKeywords = [
      'acceptable',
      'within tolerance',
      'normal variation',
      'expected',
      'seasonal',
      'supplier variation',
      'portioning acceptable',
      'recipe adjustment approved'
    ];

    return acceptableKeywords.some(keyword => lowerExplanation.includes(keyword));
  }

  /**
   * Calculate investigation workflow metrics
   * Dave's management reporting needs
   * 
   * @param {Array} analyses - Array of TheoreticalUsageAnalysis objects
   * @returns {Object} Investigation metrics summary
   */
  calculateWorkflowMetrics(analyses) {
    const metrics = {
      totalInvestigations: 0,
      byStatus: {
        pending: 0,
        investigating: 0,
        resolved: 0,
        accepted: 0,
        escalated: 0
      },
      averageDaysToResolve: 0,
      longestInvestigation: 0,
      investigationBacklog: 0,
      resolutionRate: 0
    };

    if (!analyses || analyses.length === 0) {
      return metrics;
    }

    metrics.totalInvestigations = analyses.length;
    let totalResolutionDays = 0;
    let resolvedCount = 0;

    analyses.forEach(analysis => {
      // Count by status
      const status = analysis.investigationStatus || 'pending';
      if (metrics.byStatus.hasOwnProperty(status)) {
        metrics.byStatus[status]++;
      }

      // Calculate resolution times
      const daysInInvestigation = this.getDaysInInvestigation(analysis);
      if (daysInInvestigation > metrics.longestInvestigation) {
        metrics.longestInvestigation = daysInInvestigation;
      }

      // Track resolved investigations for average calculation
      if (['resolved', 'accepted'].includes(status) && analysis.resolvedAt) {
        totalResolutionDays += daysInInvestigation;
        resolvedCount++;
      }

      // Count backlog (assigned but not resolved)
      if (['investigating', 'escalated'].includes(status)) {
        metrics.investigationBacklog++;
      }
    });

    // Calculate averages
    if (resolvedCount > 0) {
      metrics.averageDaysToResolve = Math.round(totalResolutionDays / resolvedCount * 100) / 100;
    }

    if (metrics.totalInvestigations > 0) {
      metrics.resolutionRate = Math.round((metrics.byStatus.resolved + metrics.byStatus.accepted) / metrics.totalInvestigations * 100);
    }

    return metrics;
  }

  /**
   * Get investigation status priority for Dave's workflow management
   * Higher priority statuses need more attention
   * 
   * @param {string} status - Investigation status
   * @returns {number} Priority score (higher = more urgent)
   */
  getStatusPriority(status) {
    const priorities = {
      'escalated': 4,     // Highest priority - needs immediate attention
      'investigating': 3, // Active investigation - monitor progress
      'pending': 2,       // Awaiting assignment - needs to be assigned
      'resolved': 1,      // Completed - lowest priority
      'accepted': 1       // Completed - lowest priority
    };

    return priorities[status] || 0;
  }

  /**
   * Validate investigation workflow transition
   * Dave's business rules for valid status changes
   * 
   * @param {string} currentStatus - Current investigation status
   * @param {string} newStatus - Desired new status
   * @returns {boolean} True if transition is valid
   */
  isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'pending': ['investigating'],
      'investigating': ['resolved', 'accepted', 'escalated'],
      'escalated': ['resolved', 'accepted'],
      'resolved': [], // Final state
      'accepted': []  // Final state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Enrich analysis data with investigation workflow information
   * Add computed investigation fields to analysis objects
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object
   * @returns {Object} Enriched analysis with investigation workflow data
   */
  enrichWithWorkflowData(analysis) {
    return {
      ...analysis,
      daysInInvestigation: this.getDaysInInvestigation(analysis),
      canBeResolved: this.canBeResolved(analysis),
      statusPriority: this.getStatusPriority(analysis.investigationStatus),
      isOverdue: this.getDaysInInvestigation(analysis) > 7, // Dave's 7-day SLA
      workflowStage: this.getWorkflowStage(analysis)
    };
  }

  /**
   * Determine current workflow stage for display
   * Dave's workflow visualization needs
   * 
   * @param {Object} analysis - TheoreticalUsageAnalysis data object
   * @returns {string} Workflow stage description
   */
  getWorkflowStage(analysis) {
    const status = analysis.investigationStatus;
    const hasAssignee = !!analysis.assignedTo;
    const hasInvestigator = !!analysis.investigatedBy;

    switch (status) {
      case 'pending':
        return hasAssignee ? 'Assigned - Awaiting Start' : 'Unassigned';
      case 'investigating':
        return hasInvestigator ? 'Active Investigation' : 'Assigned - Not Started';
      case 'escalated':
        return 'Escalated - Needs Attention';
      case 'resolved':
        return 'Investigation Complete';
      case 'accepted':
        return 'Variance Accepted';
      default:
        return 'Unknown Status';
    }
  }
}

export default InvestigationWorkflowService;
