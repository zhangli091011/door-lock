/**
 * Card Management Routes
 * 卡片管理路由
 * 
 * Defines routes for web admin card management
 */

import { Router, Request, Response } from 'express';
import { Database } from '../db';
import { CardController } from '../controllers/cardController';
import { webAuthMiddleware } from '../middleware/webAuthMiddleware';

/**
 * Create card management routes
 * @param db Database instance
 * @returns Express router
 */
export function createCardRoutes(db: Database): Router {
  const router = Router();
  const cardController = new CardController(db);

  /**
   * POST /api/cards
   * Add a new card
   * 
   * Requires JWT authentication
   * 
   * Requirements: 6.1, 6.2, 6.7, 6.8
   */
  router.post(
    '/',
    webAuthMiddleware,
    (req: Request, res: Response) => cardController.addCard(req, res)
  );

  /**
   * PUT /api/cards/:uid
   * Update an existing card
   * 
   * Requires JWT authentication
   * 
   * Requirements: 6.3, 6.5
   */
  router.put(
    '/:uid',
    webAuthMiddleware,
    (req: Request, res: Response) => cardController.updateCard(req, res)
  );

  /**
   * DELETE /api/cards/:uid
   * Delete a card
   * 
   * Requires JWT authentication
   * 
   * Requirements: 6.4
   */
  router.delete(
    '/:uid',
    webAuthMiddleware,
    (req: Request, res: Response) => cardController.deleteCard(req, res)
  );

  /**
   * GET /api/cards
   * List cards with pagination and filtering
   * 
   * Requires JWT authentication
   * 
   * Query parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20)
   * - enabled: Filter by enabled status (true/false)
   * - search: Search keyword (matches UID or name)
   * 
   * Requirements: 9.4
   */
  router.get(
    '/',
    webAuthMiddleware,
    (req: Request, res: Response) => cardController.listCards(req, res)
  );

  return router;
}
