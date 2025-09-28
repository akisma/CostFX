import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import InvestigationWorkflowService from '../../../src/services/InvestigationWorkflowService.js';

/**
 * Test suite for InvestigationWorkflowService
 * Testing Dave's investigation workflow business logic
 */
describe('InvestigationWorkflowService', () => {
    let service;
    let pendingAnalysis;
    let investigatingAnalysis;
    let resolvedAnalysis;

    beforeEach(() => {
        service = new InvestigationWorkflowService();
        
        // Mock current date for consistent testing
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

        // Pending investigation
        pendingAnalysis = {
            id: 1,
            investigationStatus: 'pending',
            assignedTo: null,
            assignedAt: null,
            investigatedBy: null,
            resolvedAt: null,
            investigationNotes: null,
            explanation: null
        };

        // Active investigation (started 3 days ago)
        investigatingAnalysis = {
            id: 2,
            investigationStatus: 'investigating',
            assignedTo: 'user123',
            assignedAt: new Date('2024-01-12T10:00:00Z'), // 3 days ago
            investigatedBy: 'user123',
            resolvedAt: null,
            investigationNotes: 'Checking with kitchen staff about portioning',
            explanation: null
        };

        // Resolved investigation (completed yesterday)
        resolvedAnalysis = {
            id: 3,
            investigationStatus: 'resolved',
            assignedTo: 'user123',
            assignedAt: new Date('2024-01-10T10:00:00Z'),
            investigatedBy: 'user123',
            resolvedAt: new Date('2024-01-14T15:00:00Z'), // Yesterday
            investigationNotes: 'Verified with head chef',
            explanation: 'Portion size was intentionally increased for special event'
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getDaysInInvestigation', () => {
        it('should return 0 for pending investigations', () => {
            const days = service.getDaysInInvestigation(pendingAnalysis);
            expect(days).toBe(0);
        });

        it('should return 0 when assignedAt is null', () => {
            const unassignedAnalysis = {
                investigationStatus: 'investigating',
                assignedAt: null
            };
            const days = service.getDaysInInvestigation(unassignedAnalysis);
            expect(days).toBe(0);
        });

        it('should calculate days for active investigation', () => {
            const days = service.getDaysInInvestigation(investigatingAnalysis);
            expect(days).toBe(3); // 3 days between 2024-01-12 and 2024-01-15
        });

        it('should calculate days for resolved investigation', () => {
            const days = service.getDaysInInvestigation(resolvedAnalysis);
            expect(days).toBe(4); // From 2024-01-10 to 2024-01-14
        });

        it('should handle same-day investigations', () => {
            const sameDayAnalysis = {
                investigationStatus: 'investigating',
                assignedAt: new Date('2024-01-15T08:00:00Z'),
                resolvedAt: null
            };
            const days = service.getDaysInInvestigation(sameDayAnalysis);
            expect(days).toBe(0); // Same day = 0 days
        });
    });

    describe('canBeResolved', () => {
        it('should return false for pending investigations', () => {
            const canResolve = service.canBeResolved(pendingAnalysis);
            expect(canResolve).toBe(false);
        });

        it('should return false when no investigator assigned', () => {
            const noInvestigator = {
                investigationStatus: 'investigating',
                investigatedBy: null,
                investigationNotes: 'Some notes'
            };
            const canResolve = service.canBeResolved(noInvestigator);
            expect(canResolve).toBe(false);
        });

        it('should return false when no investigation notes', () => {
            const noNotes = {
                investigationStatus: 'investigating',
                investigatedBy: 'user123',
                investigationNotes: null
            };
            const canResolve = service.canBeResolved(noNotes);
            expect(canResolve).toBe(false);
        });

        it('should return false when investigation notes are empty', () => {
            const emptyNotes = {
                investigationStatus: 'investigating',
                investigatedBy: 'user123',
                investigationNotes: '   '
            };
            const canResolve = service.canBeResolved(emptyNotes);
            expect(canResolve).toBe(false);
        });

        it('should return true for properly documented investigating status', () => {
            const canResolve = service.canBeResolved(investigatingAnalysis);
            expect(canResolve).toBe(true);
        });

        it('should return true for escalated investigations with proper documentation', () => {
            const escalatedAnalysis = {
                investigationStatus: 'escalated',
                investigatedBy: 'manager456',
                investigationNotes: 'Escalated due to recurring pattern'
            };
            const canResolve = service.canBeResolved(escalatedAnalysis);
            expect(canResolve).toBe(true);
        });

        it('should return false for already resolved investigations', () => {
            const canResolve = service.canBeResolved(resolvedAnalysis);
            expect(canResolve).toBe(false);
        });
    });

    describe('prepareAssignmentData', () => {
        it('should prepare basic assignment data', () => {
            const data = service.prepareAssignmentData('user123');
            
            expect(data.assignedTo).toBe('user123');
            expect(data.investigationStatus).toBe('investigating');
            expect(data.assignedAt).toBeInstanceOf(Date);
            expect(data.investigationNotes).toBeNull();
        });

        it('should include notes when provided', () => {
            const notes = 'Check with kitchen manager about portion sizes';
            const data = service.prepareAssignmentData('user123', notes);
            
            expect(data.assignedTo).toBe('user123');
            expect(data.investigationNotes).toBe(notes);
        });

        it('should throw error when userId is missing', () => {
            expect(() => service.prepareAssignmentData(null)).toThrow('User ID is required for investigation assignment');
            expect(() => service.prepareAssignmentData('')).toThrow('User ID is required for investigation assignment');
            expect(() => service.prepareAssignmentData(undefined)).toThrow('User ID is required for investigation assignment');
        });
    });

    describe('prepareResolutionData', () => {
        it('should prepare basic resolution data', () => {
            const explanation = 'Variance was due to special menu item with larger portions';
            const data = service.prepareResolutionData('user123', explanation);
            
            expect(data.investigatedBy).toBe('user123');
            expect(data.investigationStatus).toBe('resolved');
            expect(data.resolvedAt).toBeInstanceOf(Date);
            expect(data.explanation).toBe(explanation);
        });

        it('should use custom resolution status', () => {
            const data = service.prepareResolutionData('user123', 'Complex issue', 'escalated');
            expect(data.investigationStatus).toBe('escalated');
        });

        it('should auto-change to accepted for acceptable explanations', () => {
            const acceptableExplanation = 'This variance is acceptable due to seasonal supplier variation';
            const data = service.prepareResolutionData('user123', acceptableExplanation, 'resolved');
            
            expect(data.investigationStatus).toBe('accepted');
        });

        it('should trim explanation whitespace', () => {
            const data = service.prepareResolutionData('user123', '  Extra whitespace  ');
            expect(data.explanation).toBe('Extra whitespace');
        });

        it('should throw error when userId is missing', () => {
            expect(() => service.prepareResolutionData(null, 'explanation')).toThrow('User ID is required for investigation resolution');
        });

        it('should throw error when explanation is missing', () => {
            expect(() => service.prepareResolutionData('user123', '')).toThrow('Explanation is required for investigation resolution');
            expect(() => service.prepareResolutionData('user123', '   ')).toThrow('Explanation is required for investigation resolution');
            expect(() => service.prepareResolutionData('user123', null)).toThrow('Explanation is required for investigation resolution');
        });
    });

    describe('isExplanationAcceptable', () => {
        it('should identify acceptable explanations', () => {
            const acceptableExplanations = [
                'This variance is acceptable for this type of ingredient',
                'Within tolerance for seasonal variation',
                'Normal variation expected for this supplier',
                'Expected variance due to recipe adjustment approved by chef',
                'Supplier variation is acceptable for this item',
                'Portioning acceptable given special event requirements'
            ];

            acceptableExplanations.forEach(explanation => {
                expect(service.isExplanationAcceptable(explanation)).toBe(true);
            });
        });

        it('should identify non-acceptable explanations', () => {
            const nonAcceptableExplanations = [
                'Kitchen staff overusing ingredients',
                'Poor portion control',
                'Waste issue needs addressing',
                'Training problem identified',
                'System error in calculations'
            ];

            nonAcceptableExplanations.forEach(explanation => {
                expect(service.isExplanationAcceptable(explanation)).toBe(false);
            });
        });

        it('should handle case insensitive matching', () => {
            expect(service.isExplanationAcceptable('ACCEPTABLE VARIANCE')).toBe(true);
            expect(service.isExplanationAcceptable('within TOLERANCE')).toBe(true);
        });

        it('should handle null/empty explanations', () => {
            expect(service.isExplanationAcceptable(null)).toBe(false);
            expect(service.isExplanationAcceptable('')).toBe(false);
            expect(service.isExplanationAcceptable(undefined)).toBe(false);
        });
    });

    describe('calculateWorkflowMetrics', () => {
        it('should handle empty analysis array', () => {
            const metrics = service.calculateWorkflowMetrics([]);
            
            expect(metrics.totalInvestigations).toBe(0);
            expect(metrics.averageDaysToResolve).toBe(0);
            expect(metrics.resolutionRate).toBe(0);
        });

        it('should calculate metrics for multiple investigations', () => {
            const analyses = [
                pendingAnalysis,
                investigatingAnalysis,
                resolvedAnalysis,
                {
                    investigationStatus: 'accepted',
                    assignedAt: new Date('2024-01-13T10:00:00Z'),
                    resolvedAt: new Date('2024-01-14T10:00:00Z')
                }
            ];

            const metrics = service.calculateWorkflowMetrics(analyses);
            
            expect(metrics.totalInvestigations).toBe(4);
            expect(metrics.byStatus.pending).toBe(1);
            expect(metrics.byStatus.investigating).toBe(1);
            expect(metrics.byStatus.resolved).toBe(1);
            expect(metrics.byStatus.accepted).toBe(1);
            expect(metrics.investigationBacklog).toBe(1); // Only investigating status
            expect(metrics.resolutionRate).toBe(50); // 2 resolved out of 4 total
        });

        it('should calculate average resolution time correctly', () => {
            const analyses = [
                {
                    investigationStatus: 'resolved',
                    assignedAt: new Date('2024-01-10T10:00:00Z'),
                    resolvedAt: new Date('2024-01-12T10:00:00Z') // 2 days
                },
                {
                    investigationStatus: 'resolved',
                    assignedAt: new Date('2024-01-08T10:00:00Z'),
                    resolvedAt: new Date('2024-01-12T10:00:00Z') // 4 days
                }
            ];

            const metrics = service.calculateWorkflowMetrics(analyses);
            expect(metrics.averageDaysToResolve).toBe(3); // (2 + 4) / 2 = 3
        });
    });

    describe('getStatusPriority', () => {
        it('should return correct priority scores', () => {
            expect(service.getStatusPriority('escalated')).toBe(4);
            expect(service.getStatusPriority('investigating')).toBe(3);
            expect(service.getStatusPriority('pending')).toBe(2);
            expect(service.getStatusPriority('resolved')).toBe(1);
            expect(service.getStatusPriority('accepted')).toBe(1);
            expect(service.getStatusPriority('unknown')).toBe(0);
        });
    });

    describe('isValidStatusTransition', () => {
        it('should validate correct transitions', () => {
            expect(service.isValidStatusTransition('pending', 'investigating')).toBe(true);
            expect(service.isValidStatusTransition('investigating', 'resolved')).toBe(true);
            expect(service.isValidStatusTransition('investigating', 'accepted')).toBe(true);
            expect(service.isValidStatusTransition('investigating', 'escalated')).toBe(true);
            expect(service.isValidStatusTransition('escalated', 'resolved')).toBe(true);
            expect(service.isValidStatusTransition('escalated', 'accepted')).toBe(true);
        });

        it('should reject invalid transitions', () => {
            expect(service.isValidStatusTransition('pending', 'resolved')).toBe(false);
            expect(service.isValidStatusTransition('resolved', 'investigating')).toBe(false);
            expect(service.isValidStatusTransition('accepted', 'escalated')).toBe(false);
        });
    });

    describe('getWorkflowStage', () => {
        it('should return correct workflow stages', () => {
            expect(service.getWorkflowStage({ investigationStatus: 'pending', assignedTo: null })).toBe('Unassigned');
            expect(service.getWorkflowStage({ investigationStatus: 'pending', assignedTo: 'user123' })).toBe('Assigned - Awaiting Start');
            expect(service.getWorkflowStage({ investigationStatus: 'investigating', investigatedBy: 'user123' })).toBe('Active Investigation');
            expect(service.getWorkflowStage({ investigationStatus: 'investigating', investigatedBy: null })).toBe('Assigned - Not Started');
            expect(service.getWorkflowStage({ investigationStatus: 'escalated' })).toBe('Escalated - Needs Attention');
            expect(service.getWorkflowStage({ investigationStatus: 'resolved' })).toBe('Investigation Complete');
            expect(service.getWorkflowStage({ investigationStatus: 'accepted' })).toBe('Variance Accepted');
            expect(service.getWorkflowStage({ investigationStatus: 'unknown' })).toBe('Unknown Status');
        });
    });

    describe('enrichWithWorkflowData', () => {
        it('should enrich analysis with workflow information', () => {
            const enriched = service.enrichWithWorkflowData(investigatingAnalysis);
            
            expect(enriched.daysInInvestigation).toBe(3);
            expect(enriched.canBeResolved).toBe(true);
            expect(enriched.statusPriority).toBe(3);
            expect(enriched.isOverdue).toBe(false); // 3 days < 7 day SLA
            expect(enriched.workflowStage).toBe('Active Investigation');
        });

        it('should identify overdue investigations', () => {
            const overdueAnalysis = {
                investigationStatus: 'investigating',
                assignedAt: new Date('2024-01-07T10:00:00Z'), // 8 days ago
                investigatedBy: 'user123',
                investigationNotes: 'Working on it'
            };
            
            const enriched = service.enrichWithWorkflowData(overdueAnalysis);
            expect(enriched.isOverdue).toBe(true); // 8 days > 7 day SLA
        });
    });

    describe('Dave\'s Business Scenarios', () => {
        it('should handle Dave\'s investigation assignment workflow', () => {
            // Dave assigns investigation to kitchen manager
            const assignmentData = service.prepareAssignmentData('kitchen_mgr_001', 'Check portion sizes for saffron usage');
            
            expect(assignmentData.assignedTo).toBe('kitchen_mgr_001');
            expect(assignmentData.investigationStatus).toBe('investigating');
            expect(assignmentData.investigationNotes).toBe('Check portion sizes for saffron usage');
        });

        it('should handle Dave\'s acceptable variance resolution', () => {
            const explanation = 'Variance is acceptable - this is normal seasonal supplier variation for saffron';
            const resolutionData = service.prepareResolutionData('kitchen_mgr_001', explanation);
            
            expect(resolutionData.investigationStatus).toBe('accepted'); // Auto-changed from resolved
            expect(resolutionData.explanation).toBe(explanation);
        });

        it('should handle Dave\'s problem variance resolution', () => {
            const explanation = 'Kitchen staff were over-portioning. Training provided to all staff.';
            const resolutionData = service.prepareResolutionData('kitchen_mgr_001', explanation);
            
            expect(resolutionData.investigationStatus).toBe('resolved'); // Stays as resolved
        });

        it('should track Dave\'s investigation SLA performance', () => {
            const analyses = [
                { // Within SLA
                    investigationStatus: 'investigating',
                    assignedAt: new Date('2024-01-12T10:00:00Z'),
                    investigatedBy: 'user1'
                },
                { // Overdue
                    investigationStatus: 'investigating', 
                    assignedAt: new Date('2024-01-06T10:00:00Z'),
                    investigatedBy: 'user2'
                }
            ];

            const enriched = analyses.map(analysis => service.enrichWithWorkflowData(analysis));
            
            expect(enriched[0].isOverdue).toBe(false); // 3 days
            expect(enriched[1].isOverdue).toBe(true);  // 9 days
        });
    });
});
